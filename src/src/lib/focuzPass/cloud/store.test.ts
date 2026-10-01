import assert from 'node:assert/strict';
import test from 'node:test';
import { CloudError, supabaseCloudStore, type CloudRecordRow, type SupabaseLike } from './store';

type Call = { table: string; op: string; values?: unknown; options?: unknown; filter?: [string, unknown]; query?: string[] };

function fakeClient(opts: { user?: { id: string; email?: string } | null; error?: { code?: string; message?: string; status?: number } | null; updated?: unknown[]; rows?: unknown[] }) {
    const calls: Call[] = [];
    const result = () => Promise.resolve({ error: opts.error ?? null });
    /** A select that records how it was narrowed before it ran. */
    const selectQuery = (table: string, columns: string, query: string[] = []): ReturnType<ReturnType<SupabaseLike['from']>['select']> => ({
        maybeSingle: () => (calls.push({ table, op: 'select', values: columns, query }), Promise.resolve({ data: null, error: opts.error ?? null })),
        gt: (column, value) => selectQuery(table, columns, [...query, `gt ${column} ${value}`]),
        order: (column, options) => selectQuery(table, columns, [...query, `order ${column} ${options.ascending ? 'asc' : 'desc'}`]),
        limit: (count) => selectQuery(table, columns, [...query, `limit ${count}`]),
        then: (resolve, reject) => {
            calls.push({ table, op: 'select', values: columns, query });
            return Promise.resolve({ data: opts.rows ?? [], error: opts.error ?? null }).then(resolve, reject);
        },
    });
    const client: SupabaseLike = {
        auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: 'u1', email: 'sam@acme.test' } : opts.user }, error: null }) },
        from(table) {
            return {
                select: (columns) => selectQuery(table, columns),
                insert: (values) => (calls.push({ table, op: 'insert', values }), result()),
                update: (values) => ({
                    eq: (column, value) => ({
                        select: () => (calls.push({ table, op: 'update', values, filter: [column, value] }), Promise.resolve({ data: opts.updated ?? [{ revision: 2 }], error: opts.error ?? null })),
                    }),
                }),
                upsert: (values, options) => (calls.push({ table, op: 'upsert', values, options }), result()),
            };
        },
    };
    return { client, calls };
}

const row = (i: number): CloudRecordRow => ({ id: `id-${i}`, kind: 'item', key_id: 'k', key_version: 1, ciphertext: 'eA==', iv: 'aaaaaaaaaaaaaaaa', revision: 1, deleted: false });

test('Records go up in batches of 200, as upserts on (user_id, id)', async () => {
    const { client, calls } = fakeClient({});
    await supabaseCloudStore(client).upsertRecords(Array.from({ length: 450 }, (_, i) => row(i)));
    const upserts = calls.filter((c) => c.table === 'fp_records');
    assert.deepEqual(upserts.map((c) => (c.values as unknown[]).length), [200, 200, 50]);
    assert.ok(upserts.every((c) => (c.options as { onConflict: string }).onConflict === 'user_id,id'));
});

test('Account updates carry the next revision and must hit exactly one row', async () => {
    const account = { user_id: 'u1', format: 1, kdf: 'pbkdf2-sha256' as const, iterations: 600000, salt: 'c2FsdA==', secret_key_id: 'ABC123', wrapped_account_key: { iv: 'a', ct: 'b' }, recovery_wrapped_account_key: null, revision: 2 };
    const ok = fakeClient({});
    await supabaseCloudStore(ok.client).updateAccount(account);
    assert.deepEqual(ok.calls[0]?.filter, ['user_id', 'u1']);
    assert.equal((ok.calls[0]?.values as { revision: number }).revision, 2);
    const none = fakeClient({ updated: [] });
    await assert.rejects(supabaseCloudStore(none.client).updateAccount(account), /no cloud copy/);
});

test('Database answers become errors the UI can act on', async () => {
    const cases: [{ code?: string; message?: string; status?: number }, string][] = [
        [{ code: '42501', message: 'new row violates row-level security policy' }, 'not-pro'],
        [{ code: 'PT409', message: 'FocuzPass: stale revision' }, 'conflict'],
        [{ status: 409, message: 'Conflict' }, 'conflict'],
        [{ code: '23505', message: 'duplicate key' }, 'exists'],
        [{ message: 'TypeError: Failed to fetch' }, 'offline'],
        [{ code: 'XX000', message: 'boom' }, 'unknown'],
    ];
    for (const [error, code] of cases) {
        const { client } = fakeClient({ error });
        await assert.rejects(supabaseCloudStore(client).addEvent('cloud_enabled'), (e: unknown) => e instanceof CloudError && e.code === code, code);
    }
});

test('Pulls ask for the account\'s rows after the cursor, oldest first, a page at a time', async () => {
    const { client, calls } = fakeClient({ rows: [{ ...row(1), server_seq: '42', revision: '3' }] });
    const rows = await supabaseCloudStore(client).listRecords(17, 500);
    assert.deepEqual(calls[0]?.query, ['gt server_seq 17', 'order server_seq asc', 'limit 500']);
    assert.equal(rows[0]?.server_seq, 42, 'bigint columns come back as numbers');
    assert.equal(rows[0]?.revision, 3);
    assert.ok(!String(calls[0]?.values).includes('user_id'), 'row-level security picks the account, not a filter the client could change');
});

test('Signed out: nothing is sent', async () => {
    const { client, calls } = fakeClient({ user: null });
    const store = supabaseCloudStore(client);
    assert.equal(await store.currentUser(), null);
    await assert.rejects(store.upsertRecords([row(1)]), (e: unknown) => e instanceof CloudError && e.code === 'signed-out');
    assert.equal(calls.length, 0);
});

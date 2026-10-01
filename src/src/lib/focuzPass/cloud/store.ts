/**
 * Where FocuzPass Cloud rows live. Rows only ever hold ciphertext and what sync needs
 * (supabase/migrations/20260929180000_focuzpass_cloud.sql). The Supabase store is what the
 * extension uses; the memory store backs tests.
 */

import type { EncryptedPayload } from '../types';
import type { RecordKind } from './keys';

export type CloudAccountRow = {
    user_id: string;
    format: number;
    kdf: 'pbkdf2-sha256';
    iterations: number;
    salt: string;
    secret_key_id: string;
    wrapped_account_key: EncryptedPayload;
    recovery_wrapped_account_key: EncryptedPayload | null;
    revision: number;
};

export type CloudKeyRow = { id: string; key_version: number; wrapped_key: EncryptedPayload; revision: number };

export type CloudRecordRow = {
    id: string;
    kind: RecordKind;
    key_id: string;
    key_version: number;
    ciphertext: string;
    iv: string;
    revision: number;
    deleted: boolean;
};

/** A record as a pull returns it: with the server's sync cursor. */
export type PulledRecordRow = CloudRecordRow & { server_seq: number };

export type CloudEventKind = 'cloud_enabled' | 'cloud_deleted' | 'password_changed' | 'recovery_key_created' | 'device_added';

/** Why a cloud call failed, in terms the UI can act on. */
export type CloudErrorCode = 'signed-out' | 'not-pro' | 'conflict' | 'exists' | 'missing' | 'offline' | 'unknown';

export class CloudError extends Error {
    constructor(readonly code: CloudErrorCode, message: string) {
        super(message);
        this.name = 'CloudError';
    }
}

export interface CloudStore {
    /** The signed-in account, or null when signed out. */
    currentUser(): Promise<{ id: string; email?: string } | null>;
    getAccount(): Promise<CloudAccountRow | null>;
    createAccount(row: CloudAccountRow): Promise<void>;
    /** Writes the next revision of the account row (row.revision = stored + 1). */
    updateAccount(row: CloudAccountRow): Promise<void>;
    putKey(row: CloudKeyRow): Promise<void>;
    listKeys(): Promise<CloudKeyRow[]>;
    /** Insert-or-update; each row's revision must be the stored one + 1 (1 for new rows). */
    upsertRecords(rows: CloudRecordRow[]): Promise<void>;
    /** This account's records written after `afterSeq`, oldest first. */
    listRecords(afterSeq: number, limit: number): Promise<PulledRecordRow[]>;
    addEvent(kind: CloudEventKind): Promise<void>;
}

/* ── Memory store (tests) ──────────────────────────────────────────────── */

export type MemoryCloud = {
    /** One sequence for every account, like fp_records_seq. */
    seq: number;
    users: Map<string, { email?: string; pro: boolean }>;
    accounts: Map<string, CloudAccountRow>;
    keys: Map<string, CloudKeyRow & { user_id: string }>;
    records: Map<string, CloudRecordRow & { user_id: string; server_seq: number }>;
    events: { user_id: string; kind: CloudEventKind }[];
    /** Everything each request carried, as it would go over the network. */
    wire: string[];
};

export function createMemoryCloud(): MemoryCloud {
    return { seq: 0, users: new Map(), accounts: new Map(), keys: new Map(), records: new Map(), events: [], wire: [] };
}

/** Behaves like the tables' row-level security and triggers for one signed-in user. */
export function memoryCloudStore(cloud: MemoryCloud, signedInAs: () => string | null): CloudStore {
    const me = () => {
        const id = signedInAs();
        if (!id || !cloud.users.has(id)) throw new CloudError('signed-out', 'Sign in to FocuzNow to use Cloud sync.');
        return id;
    };
    const mustWrite = (id: string) => {
        if (!cloud.users.get(id)?.pro) throw new CloudError('not-pro', 'Cloud sync is part of FocuzNow Pro.');
    };
    const send = (what: string, body: unknown) => cloud.wire.push(`${what} ${JSON.stringify(body)}`);
    return {
        async currentUser() {
            const id = signedInAs();
            return id && cloud.users.has(id) ? { id, email: cloud.users.get(id)!.email } : null;
        },
        async getAccount() {
            const id = me();
            return structuredClone(cloud.accounts.get(id) ?? null);
        },
        async createAccount(row) {
            const id = me();
            send('POST fp_accounts', row);
            mustWrite(id);
            if (row.user_id !== id) throw new CloudError('unknown', 'row-level security');
            if (cloud.accounts.has(id)) throw new CloudError('exists', 'Cloud sync is already on for this account.');
            cloud.accounts.set(id, structuredClone(row));
        },
        async updateAccount(row) {
            const id = me();
            send('PATCH fp_accounts', row);
            mustWrite(id);
            const stored = cloud.accounts.get(id);
            if (!stored || row.user_id !== id) throw new CloudError('unknown', 'No cloud account to update.');
            if (row.revision !== stored.revision + 1) throw new CloudError('conflict', 'The cloud copy changed. Try again.');
            cloud.accounts.set(id, structuredClone(row));
        },
        async putKey(row) {
            const id = me();
            send('POST fp_keys', row);
            mustWrite(id);
            const key = `${id}/${row.id}`;
            const stored = cloud.keys.get(key);
            if (stored && row.revision !== stored.revision + 1) throw new CloudError('conflict', 'The cloud copy changed. Try again.');
            cloud.keys.set(key, { ...structuredClone(row), user_id: id });
        },
        async listKeys() {
            const id = me();
            return [...cloud.keys.values()].filter((k) => k.user_id === id).map((k) => ({ id: k.id, key_version: k.key_version, wrapped_key: structuredClone(k.wrapped_key), revision: k.revision }));
        },
        async upsertRecords(rows) {
            const id = me();
            send('POST fp_records', rows);
            mustWrite(id);
            for (const row of rows) {
                if (!cloud.keys.has(`${id}/${row.key_id}`)) throw new CloudError('unknown', 'Unknown key.');
                const key = `${id}/${row.id}`;
                const stored = cloud.records.get(key);
                if (row.revision !== (stored ? stored.revision + 1 : row.revision)) throw new CloudError('conflict', 'The cloud copy changed. Try again.');
            }
            for (const row of rows) cloud.records.set(`${id}/${row.id}`, { ...structuredClone(row), user_id: id, server_seq: ++cloud.seq });
        },
        async listRecords(afterSeq, limit) {
            const id = me();
            send('GET fp_records', { afterSeq, limit });
            return [...cloud.records.values()]
                .filter((r) => r.user_id === id && r.server_seq > afterSeq)
                .sort((a, b) => a.server_seq - b.server_seq)
                .slice(0, limit)
                .map((r) => ({ id: r.id, kind: r.kind, key_id: r.key_id, key_version: r.key_version, ciphertext: r.ciphertext, iv: r.iv, revision: r.revision, deleted: r.deleted, server_seq: r.server_seq }));
        },
        async addEvent(kind) {
            const id = me();
            send('POST fp_security_events', { kind });
            cloud.events.push({ user_id: id, kind });
        },
    };
}

/* ── Supabase store (the extension) ────────────────────────────────────── */

type SupabaseError = { code?: string; message?: string; status?: number } | null;

type SelectQuery = PromiseLike<{ data: unknown[] | null; error: SupabaseError }> & {
    maybeSingle(): PromiseLike<{ data: unknown; error: SupabaseError }>;
    gt(column: string, value: unknown): SelectQuery;
    order(column: string, options: { ascending: boolean }): SelectQuery;
    limit(count: number): SelectQuery;
};

/** The slice of the Supabase client this store uses. */
export type SupabaseLike = {
    auth: { getUser(): Promise<{ data: { user: { id: string; email?: string } | null }; error: unknown }> };
    from(table: string): {
        select(columns: string): SelectQuery;
        insert(values: unknown): PromiseLike<{ error: SupabaseError }>;
        update(values: unknown): { eq(column: string, value: unknown): { select(columns: string): PromiseLike<{ data: unknown[] | null; error: SupabaseError }> } };
        upsert(values: unknown, options: { onConflict: string }): PromiseLike<{ error: SupabaseError }>;
    };
};

function cloudErrorFrom(error: NonNullable<SupabaseError>): CloudError {
    const code = error.code ?? '';
    if (code === '42501') return new CloudError('not-pro', 'Cloud sync is part of FocuzNow Pro.');
    if (code === 'PT409' || error.status === 409) return new CloudError('conflict', 'The cloud copy changed. Try again.');
    if (code === '23505') return new CloudError('exists', 'Cloud sync is already on for this account.');
    if (/fetch|network|failed to fetch/i.test(error.message ?? '')) return new CloudError('offline', 'Can\'t reach FocuzNow. Check your connection and try again.');
    return new CloudError('unknown', 'FocuzNow couldn\'t save to the cloud. Try again.');
}

const BATCH = 200;

export function supabaseCloudStore(client: SupabaseLike): CloudStore {
    const check = (error: SupabaseError) => {
        if (error) throw cloudErrorFrom(error);
    };
    const userId = async () => {
        const { data } = await client.auth.getUser();
        if (!data.user) throw new CloudError('signed-out', 'Sign in to FocuzNow to use Cloud sync.');
        return data.user.id;
    };
    return {
        async currentUser() {
            const { data } = await client.auth.getUser();
            return data.user ? { id: data.user.id, email: data.user.email } : null;
        },
        async getAccount() {
            await userId();
            const { data, error } = await client.from('fp_accounts').select('user_id, format, kdf, iterations, salt, secret_key_id, wrapped_account_key, recovery_wrapped_account_key, revision').maybeSingle();
            check(error);
            return (data as CloudAccountRow | null) ?? null;
        },
        async createAccount(row) {
            await userId();
            check((await client.from('fp_accounts').insert(row)).error);
        },
        async updateAccount(row) {
            const id = await userId();
            // The table's trigger refuses anything but stored revision + 1.
            const { data, error } = await client
                .from('fp_accounts')
                .update({ iterations: row.iterations, salt: row.salt, secret_key_id: row.secret_key_id, wrapped_account_key: row.wrapped_account_key, recovery_wrapped_account_key: row.recovery_wrapped_account_key, revision: row.revision })
                .eq('user_id', id)
                .select('revision');
            check(error);
            if (!Array.isArray(data) || data.length !== 1) throw new CloudError('unknown', 'There\'s no cloud copy to update.');
        },
        async putKey(row) {
            await userId();
            check((await client.from('fp_keys').upsert(row, { onConflict: 'user_id,id' })).error);
        },
        async listKeys() {
            await userId();
            const { data, error } = await client.from('fp_keys').select('id, key_version, wrapped_key, revision');
            check(error);
            return (data as CloudKeyRow[] | null) ?? [];
        },
        async upsertRecords(rows) {
            await userId();
            for (let i = 0; i < rows.length; i += BATCH) {
                check((await client.from('fp_records').upsert(rows.slice(i, i + BATCH), { onConflict: 'user_id,id' })).error);
            }
        },
        async listRecords(afterSeq, limit) {
            await userId();
            // Row-level security limits this to the signed-in account's rows.
            const { data, error } = await client
                .from('fp_records')
                .select('id, kind, key_id, key_version, ciphertext, iv, revision, deleted, server_seq')
                .gt('server_seq', afterSeq)
                .order('server_seq', { ascending: true })
                .limit(limit);
            check(error);
            return ((data as PulledRecordRow[] | null) ?? []).map((row) => ({ ...row, server_seq: Number(row.server_seq), revision: Number(row.revision) }));
        },
        async addEvent(kind) {
            await userId();
            check((await client.from('fp_security_events').insert({ kind })).error);
        },
    };
}

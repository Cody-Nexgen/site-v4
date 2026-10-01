import assert from 'node:assert/strict';
import test from 'node:test';
import { FocuzPassVault, createMemoryStorage, type DecryptedVaultItem } from '../vaultCore';
import { importRawVaultKey } from '../crypto';
import { deriveUnlockKey, parseAccountKey, recordIdFor, sealRecord, unwrapAccountKey, unwrapVaultKeyFromCloud } from './keys';
import { CloudError, createMemoryCloud, memoryCloudStore, type CloudStore, type MemoryCloud } from './store';
import { canonicalJson, mergeRemote, type OpenedRemote } from './sync';
import { WRONG_SECRETS } from './join';

const USER = '11111111-aaaa-4aaa-8aaa-111111111111';
const OTHER = '33333333-cccc-4ccc-8ccc-333333333333';
const MASTER = 'correct-horse-master-9';

const SECRETS = ['gh-pass-1', 'recovery codes in drawer', '4111111111111111', 'netpw-99', 'edited-pass-2', 'phone-pass-3', 'laptop-pass-4', 'C-only-secret'];

function world() {
    const cloud = createMemoryCloud();
    cloud.users.set(USER, { email: 'sam@acme.test', pro: true });
    cloud.users.set(OTHER, { email: 'other@acme.test', pro: true });
    let signedIn: string | null = USER;
    const store = memoryCloudStore(cloud, () => signedIn);
    return { cloud, store, signIn: (id: string | null) => (signedIn = id) };
}

/** Device A: a filled vault with Cloud sync turned on. Returns its Security Key. */
async function firstDevice(store: CloudStore) {
    const a = new FocuzPassVault(createMemoryStorage());
    await a.setup(MASTER);
    const work = await a.createVault({ name: 'Work', color: '#4e91da', icon: 'vault' });
    const tag = await a.createTag({ name: 'Finance', color: '#e0af68', icon: 'tag' });
    await a.upsert({ type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'gh-pass-1', note: 'recovery codes in drawer', vaultId: work.id });
    await a.upsert({ type: 'card', title: 'Chase Sapphire', identity: 'Sam Lee', cardNumber: '4111111111111111', expiry: '11/27', cvv: '321', tagIds: [tag.id] });
    await a.upsert({ type: 'custom', kind: 'wireless_router', title: 'Home Wi-Fi', identity: 'FocuzHouse', fields: { networkName: 'FocuzHouse', password: 'netpw-99' } });
    const kit = await a.prepareCloud(MASTER, { id: USER, email: 'sam@acme.test' });
    await a.enableCloud(store);
    return { a, secretKey: kit.secretKey };
}

async function joinedDevice(store: CloudStore, secretKey: string) {
    const b = new FocuzPassVault(createMemoryStorage());
    await b.joinCloud(store, { masterPassword: MASTER, secretKey });
    return b;
}

const byTitle = (vault: FocuzPassVault, title: string) => vault.snapshot().items.find((item) => item.title === title);
const liveTitles = (vault: FocuzPassVault) => vault.snapshot().items.filter((item) => !item.deletedAt).map((item) => item.title).sort();

/** The vault key, the way only a device with both secrets gets it (to forge rows in the tamper tests). */
async function vaultKeyOf(cloud: MemoryCloud, secretKey: string) {
    const account = cloud.accounts.get(USER)!;
    const accountKey = await unwrapAccountKey(await deriveUnlockKey(MASTER, parseAccountKey(secretKey, 'secret')!, USER, account), account.wrapped_account_key, USER);
    const key = [...cloud.keys.values()].find((k) => k.user_id === USER)!;
    return { key, vaultKey: await importRawVaultKey(await unwrapVaultKeyFromCloud(accountKey, key.wrapped_key, USER, key.id, key.key_version)) };
}

function assertNothingReadable(cloud: MemoryCloud) {
    const wire = cloud.wire.join('\n');
    for (const secret of SECRETS) assert.ok(!wire.includes(secret), `"${secret}" went over the wire`);
}

test('A second device joins with the master password and Security Key, and gets everything', async () => {
    const { cloud, store, signIn } = world();
    const { a, secretKey } = await firstDevice(store);

    const fresh = () => new FocuzPassVault(createMemoryStorage());
    await assert.rejects(fresh().joinCloud(store, { masterPassword: 'wrong-master-1', secretKey }), new RegExp(WRONG_SECRETS.slice(0, 30)));
    const otherKey = parseAccountKey(secretKey, 'secret')!.replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    await assert.rejects(fresh().joinCloud(store, { masterPassword: MASTER, secretKey: otherKey }), /don't open this account/);
    await assert.rejects(fresh().joinCloud(store, { masterPassword: MASTER, secretKey: 'not a key' }), /doesn't look like a Security Key/);
    signIn(null);
    await assert.rejects(fresh().joinCloud(store, { masterPassword: MASTER, secretKey }), (e: unknown) => e instanceof CloudError && e.code === 'signed-out');
    signIn(OTHER);
    await assert.rejects(fresh().joinCloud(store, { masterPassword: MASTER, secretKey }), (e: unknown) => e instanceof CloudError && e.code === 'missing');
    signIn(USER);

    const b = await joinedDevice(store, secretKey.toLowerCase().replace(/-/g, ' '));
    assert.deepEqual(liveTitles(b), liveTitles(a));
    assert.equal((byTitle(b, 'GitHub') as Extract<DecryptedVaultItem, { type: 'login' }>).password, 'gh-pass-1');
    assert.deepEqual(b.snapshot().vaults.map((v) => v.name).sort(), a.snapshot().vaults.map((v) => v.name).sort());
    assert.equal(byTitle(b, 'GitHub')!.vaultId, byTitle(a, 'GitHub')!.vaultId, 'items stay in their vault');
    assert.equal(b.cloudStatus().state, 'on');
    assert.ok(b.cloudStatus().joinedAt);
    assert.ok(cloud.events.some((e) => e.kind === 'device_added'));

    // B unlocks with the cloud master password from now on, and a join sends nothing back up.
    const writes = cloud.wire.filter((w) => w.startsWith('POST fp_records')).length;
    b.lock();
    await b.unlock(MASTER);
    assert.deepEqual(await b.syncCloud(store), { pulled: 0, pushed: 0, conflicts: 0, refused: 0 });
    assert.equal(cloud.wire.filter((w) => w.startsWith('POST fp_records')).length, writes);
    assertNothingReadable(cloud);
});

test('Edits, trash and permanent deletes reach the other device, and only ciphertext travels', async () => {
    const { cloud, store } = world();
    const { a, secretKey } = await firstDevice(store);
    const b = await joinedDevice(store, secretKey);

    const github = byTitle(a, 'GitHub')!;
    await a.upsert({ id: github.id, type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'edited-pass-2' });
    await a.itemAction({ action: 'trash', id: byTitle(a, 'Home Wi-Fi')!.id });
    await a.createTag({ name: 'Shared', color: '#63b995', icon: 'tag' });
    assert.ok((await a.syncCloud(store)).pushed >= 3);
    const pulled = await b.syncCloud(store);
    assert.equal(pulled.pulled, 3);
    assert.equal((byTitle(b, 'GitHub') as Extract<DecryptedVaultItem, { type: 'login' }>).password, 'edited-pass-2');
    assert.ok(byTitle(b, 'Home Wi-Fi')!.deletedAt, 'trash is an ordinary change');
    assert.ok(b.snapshot().tags.some((t) => t.name === 'Shared'));

    await b.itemAction({ action: 'purge', id: byTitle(b, 'Home Wi-Fi')!.id });
    await b.syncCloud(store);
    const tombstone = [...cloud.records.values()].find((r) => r.deleted);
    assert.ok(tombstone, 'a permanent delete leaves a tombstone');
    assert.equal(tombstone!.ciphertext, '');
    await a.syncCloud(store);
    assert.equal(byTitle(a, 'Home Wi-Fi'), undefined);
    assertNothingReadable(cloud);
});

test('Both devices change the same login offline: nothing is lost', async () => {
    const { store } = world();
    const { a, secretKey } = await firstDevice(store);
    const b = await joinedDevice(store, secretKey);
    const id = byTitle(a, 'GitHub')!.id;

    // Different passwords on each device: both survive, the later sync's copy marked as a conflict.
    await a.upsert({ id, type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'laptop-pass-4' });
    await b.upsert({ id, type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'phone-pass-3' });
    await a.syncCloud(store);
    const result = await b.syncCloud(store);
    assert.equal(result.conflicts, 1);
    await a.syncCloud(store);
    for (const device of [a, b]) {
        const logins = device.snapshot().items.filter((item) => item.type === 'login' && item.title.startsWith('GitHub')) as Extract<DecryptedVaultItem, { type: 'login' }>[];
        assert.deepEqual(logins.map((l) => l.password).sort(), ['laptop-pass-4', 'phone-pass-3']);
        assert.ok(logins.some((l) => l.title === 'GitHub (conflict copy)' && l.password === 'phone-pass-3'));
    }

    // Same secrets, different details: the later edit wins, no copy.
    const card = byTitle(a, 'Chase Sapphire')!;
    await a.itemAction({ action: 'favorite', id: card.id, value: true });
    await new Promise((r) => setTimeout(r, 5));
    await b.upsert({ id: card.id, type: 'card', title: 'Chase Sapphire Reserve', identity: 'Sam Lee' });
    await a.syncCloud(store);
    assert.equal((await b.syncCloud(store)).conflicts, 0);
    await a.syncCloud(store);
    assert.equal(byTitle(a, 'Chase Sapphire Reserve')?.id, card.id);
    assert.equal(byTitle(b, 'Chase Sapphire Reserve')?.id, card.id);
    assert.equal(liveTitles(a).join('|'), liveTitles(b).join('|'));
});

test('Deleted on one device, edited on the other: the edit wins', async () => {
    const { store } = world();
    const { a, secretKey } = await firstDevice(store);
    const b = await joinedDevice(store, secretKey);
    const id = byTitle(a, 'Home Wi-Fi')!.id;
    await a.itemAction({ action: 'purge', id });
    await a.syncCloud(store);
    await b.upsert({ id, type: 'custom', kind: 'wireless_router', title: 'Home Wi-Fi 5G', identity: 'FocuzHouse' });
    await b.syncCloud(store);
    await a.syncCloud(store);
    assert.equal(byTitle(a, 'Home Wi-Fi 5G')?.id, id);
    assert.equal(byTitle(b, 'Home Wi-Fi 5G')?.id, id);
});

test('Tampered, swapped, forged or rolled-back rows are refused; honest ones still sync', async () => {
    const { cloud, store } = world();
    const { a, secretKey } = await firstDevice(store);
    const b = await joinedDevice(store, secretKey);
    const githubId = byTitle(a, 'GitHub')!.id;
    const cardId = byTitle(a, 'Chase Sapphire')!.id;
    const rowOf = (id: string) => cloud.records.get(`${USER}/${id}`)!;
    const bump = (row: ReturnType<typeof rowOf>, change: Partial<ReturnType<typeof rowOf>>) => cloud.records.set(`${USER}/${row.id}`, { ...row, ...change, revision: row.revision + 1, server_seq: ++cloud.seq });

    // 1. The server flips bits in a record.
    const github = rowOf(githubId);
    bump(github, { ciphertext: github.ciphertext.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) });
    // 2. The server moves the card's ciphertext under another id (and bumps it so it looks new).
    const card = rowOf(cardId);
    const wifi = rowOf(byTitle(a, 'Home Wi-Fi')!.id);
    bump(wifi, { ciphertext: card.ciphertext, iv: card.iv });
    const result = await b.syncCloud(store);
    assert.equal(result.refused, 2);
    assert.equal((byTitle(b, 'GitHub') as Extract<DecryptedVaultItem, { type: 'login' }>).password, 'gh-pass-1', 'the local copy is untouched');
    assert.equal(byTitle(b, 'Home Wi-Fi')!.type, 'custom');

    // 3. A row sealed properly but claiming to be another record (id inside ≠ row id).
    const { key, vaultKey } = await vaultKeyOf(cloud, secretKey);
    const forgedId = crypto.randomUUID();
    const meta = { userId: USER, id: forgedId, kind: 'item' as const, revision: 1, keyId: key.id, keyVersion: key.key_version };
    const sealed = await sealRecord(vaultKey, meta, canonicalJson({ v: 1, item: { ...byTitle(a, 'GitHub'), password: 'forged' } }));
    cloud.records.set(`${USER}/${forgedId}`, { id: forgedId, kind: 'item', key_id: key.id, key_version: 1, ...sealed, revision: 1, deleted: false, user_id: USER, server_seq: ++cloud.seq });
    // 4. An old, genuine version of the card replayed with a fresh cursor but its old revision.
    const oldCard = { ...card, server_seq: ++cloud.seq };
    await a.upsert({ id: cardId, type: 'card', title: 'Chase Sapphire', identity: 'Sam Lee', cvv: '999' });
    await a.syncCloud(store);
    const newest = rowOf(cardId);
    cloud.records.set(`${USER}/${cardId}`, oldCard);
    const second = await b.syncCloud(store);
    assert.equal(second.refused, 1, 'the forged record');
    assert.equal(byTitle(b, 'GitHub')!.id, githubId);
    assert.ok(!b.snapshot().items.some((item) => item.id === forgedId));
    // B never saw the newer card (the server swapped it back before B pulled), but it also never goes backwards once it has.
    cloud.records.set(`${USER}/${cardId}`, { ...newest, server_seq: ++cloud.seq });
    await b.syncCloud(store);
    assert.equal((byTitle(b, 'Chase Sapphire') as Extract<DecryptedVaultItem, { type: 'card' }>).cvv, '999');
    cloud.records.set(`${USER}/${cardId}`, { ...oldCard, server_seq: ++cloud.seq });
    await b.syncCloud(store);
    assert.equal((byTitle(b, 'Chase Sapphire') as Extract<DecryptedVaultItem, { type: 'card' }>).cvv, '999', 'an older revision is ignored');
});

test('A change made while a sync is merging isn\'t lost', async () => {
    const { cloud, store } = world();
    const { a, secretKey } = await firstDevice(store);
    const b = await joinedDevice(store, secretKey);
    await a.upsert({ id: byTitle(a, 'GitHub')!.id, type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'edited-pass-2' });
    await a.syncCloud(store);

    // B's pull is slow; while it's in flight, B saves a new login.
    const slow: CloudStore = {
        ...store,
        listRecords: async (after, limit) => {
            const rows = await store.listRecords(after, limit);
            if (!slowed) {
                slowed = true;
                await b.upsert({ type: 'login', title: 'Added mid-sync', identity: 'sam', password: 'C-only-secret' });
            }
            return rows;
        },
    };
    let slowed = false;
    await b.syncCloud(slow);
    assert.equal((byTitle(b, 'GitHub') as Extract<DecryptedVaultItem, { type: 'login' }>).password, 'edited-pass-2');
    assert.ok(byTitle(b, 'Added mid-sync'));
    await a.syncCloud(store);
    assert.ok(byTitle(a, 'Added mid-sync'), 'and it reached the other device');
    assertNothingReadable(cloud);
});

test('Editing the very record a sync is about to replace: the merge starts over, and the edit survives', async () => {
    const { store } = world();
    const { a, secretKey } = await firstDevice(store);
    const b = await joinedDevice(store, secretKey);
    const id = byTitle(a, 'GitHub')!.id;
    await a.upsert({ id, type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'edited-pass-2' });
    await a.syncCloud(store);

    // The moment B's sync copies the vault to merge against, B renames that same login.
    let armed = false;
    let fired = false;
    const realClone = globalThis.structuredClone;
    globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
        if (armed && !fired) {
            fired = true;
            void b.upsert({ id, type: 'login', title: 'GitHub (phone)', identity: 'sam@acme.test', domain: 'github.com' });
        }
        return realClone(value, options);
    }) as typeof structuredClone;
    const hooked: CloudStore = {
        ...store,
        listRecords: async (after, limit) => {
            const rows = await store.listRecords(after, limit);
            armed = true;
            return rows;
        },
    };
    try {
        await b.syncCloud(hooked);
    } finally {
        globalThis.structuredClone = realClone;
    }
    assert.ok(fired);
    const logins = b.snapshot().items.filter((item) => item.type === 'login' && item.title.startsWith('GitHub')) as Extract<DecryptedVaultItem, { type: 'login' }>[];
    assert.ok(logins.some((l) => l.title.startsWith('GitHub (phone)') && l.password === 'gh-pass-1'), 'the rename made mid-merge is still there');
    assert.ok(logins.some((l) => l.password === 'edited-pass-2'), 'and so is the other device\'s change');
});

test('A device with its own vault joins: its items are added, and it switches to the cloud master password', async () => {
    const { cloud, store } = world();
    const { a, secretKey } = await firstDevice(store);
    const c = new FocuzPassVault(createMemoryStorage());
    await c.setup('laptop-master-7');
    const work = await c.createVault({ name: 'work', color: '#111111', icon: 'vault' });
    await c.upsert({ type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'gh-pass-1' }); // already in the cloud
    await c.upsert({ type: 'login', title: 'Laptop only', identity: 'sam', password: 'C-only-secret', vaultId: work.id });

    await assert.rejects(c.addToCloud(store, { masterPassword: MASTER, secretKey, localPassword: 'not-it-12' }), /master password/);
    await assert.rejects(c.addToCloud(store, { masterPassword: 'wrong-master-1', secretKey, localPassword: 'laptop-master-7' }), /don't open this account/);
    const before = liveTitles(c);
    assert.deepEqual(before, ['GitHub', 'Laptop only'], 'a failed attempt changes nothing');

    const { added, alreadyThere } = await c.addToCloud(store, { masterPassword: MASTER, secretKey, localPassword: 'laptop-master-7' });
    assert.deepEqual({ added, alreadyThere }, { added: 1, alreadyThere: 1 });
    assert.deepEqual(liveTitles(c), ['Chase Sapphire', 'GitHub', 'Home Wi-Fi', 'Laptop only']);
    const laptop = byTitle(c, 'Laptop only')!;
    assert.equal(c.snapshot().vaults.find((v) => v.id === laptop.vaultId)?.name, 'Work', 'vaults with the same name are merged');
    assert.equal(c.snapshot().vaults.filter((v) => v.name.toLowerCase() === 'work').length, 1);

    c.lock();
    await assert.rejects(c.unlock('laptop-master-7'), /Incorrect master password/);
    await c.unlock(MASTER);
    await c.syncCloud(store);
    await a.syncCloud(store);
    assert.ok(byTitle(a, 'Laptop only'));
    assertNothingReadable(cloud);
});

test('Records from a newer version are kept as they are, never deleted or rewritten', async () => {
    const { cloud, store } = world();
    const { a, secretKey } = await firstDevice(store);
    const { key, vaultKey } = await vaultKeyOf(cloud, secretKey);
    const plant = async (kind: 'item' | 'setting', body: Record<string, unknown>) => {
        const id = await recordIdFor(kind, String(body.id));
        const meta = { userId: USER, id, kind, revision: 1, keyId: key.id, keyVersion: key.key_version };
        const sealed = await sealRecord(vaultKey, meta, canonicalJson({ v: 1, [kind]: body }));
        cloud.records.set(`${USER}/${id}`, { id, kind, key_id: key.id, key_version: 1, ...sealed, revision: 1, deleted: false, user_id: USER, server_seq: ++cloud.seq });
        return id;
    };
    const doc = await plant('item', { id: crypto.randomUUID(), type: 'document', title: 'Passport scan', identity: '' });
    const setting = await plant('setting', { id: 'autofill', inline: true });
    // A login with a field this version doesn't know.
    const github = byTitle(a, 'GitHub')!;
    const future = await plant('item', { ...github, id: crypto.randomUUID(), title: 'Future login', futureField: 'x' });

    const b = await joinedDevice(store, secretKey);
    assert.ok(byTitle(b, 'Future login'));
    await b.upsert({ type: 'login', title: 'Something else', identity: 'sam', password: 'x-pass-1' });
    await b.syncCloud(store);
    await a.syncCloud(store);
    for (const id of [doc, setting, future]) {
        const row = cloud.records.get(`${USER}/${id}`)!;
        assert.equal(row.revision, 1, 'untouched');
        assert.equal(row.deleted, false);
    }
    b.lock();
    await b.unlock(MASTER);
    await b.syncCloud(store);
    assert.equal(cloud.records.get(`${USER}/${doc}`)!.revision, 1, 'still there after a restart');
});

test('A lapsed account still pulls, but its pushes are refused and reported', async () => {
    const { cloud, store } = world();
    const { a, secretKey } = await firstDevice(store);
    const b = await joinedDevice(store, secretKey);
    await a.upsert({ type: 'login', title: 'Before lapse', identity: 'sam', password: 'x-pass-1' });
    await a.syncCloud(store);
    cloud.users.get(USER)!.pro = false;
    await b.syncCloud(store).catch(() => undefined);
    assert.ok(byTitle(b, 'Before lapse'), 'pulling still works');
    await b.upsert({ type: 'login', title: 'After lapse', identity: 'sam', password: 'x-pass-2' });
    await assert.rejects(b.syncCloud(store), (e: unknown) => e instanceof CloudError && e.code === 'not-pro');
    assert.equal(b.cloudStatus().syncError?.code, 'not-pro');
    cloud.users.get(USER)!.pro = true;
    await b.syncCloud(store);
    assert.equal(b.cloudStatus().syncError, undefined, 'resubscribing picks up where it stopped');
    await a.syncCloud(store);
    assert.ok(byTitle(a, 'After lapse'));
});

test('Merging: seen revisions, rollbacks and duplicates in one pull', async () => {
    const remote = (id: string, rev: number, hash: string): OpenedRemote => ({ id, kind: 'item', rev, seq: rev, deleted: false, record: { kind: 'item', localId: id, body: { id, title: hash } }, hash });
    const synced = { a: { rev: 3, hash: 'h3' } };
    const merged = mergeRemote(new Map(), [remote('a', 2, 'old'), remote('a', 3, 'h3'), remote('b', 1, 'x'), remote('b', 2, 'y')], synced);
    assert.deepEqual(merged.changes.upserts.map((r) => `${r.localId}:${r.body.title}`), ['b:y'], 'only the newest version of b; nothing for a');
    assert.deepEqual(merged.synced.a, { rev: 3, hash: 'h3' });
});

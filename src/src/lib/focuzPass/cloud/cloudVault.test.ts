import assert from 'node:assert/strict';
import test from 'node:test';
import { FocuzPassVault, createMemoryStorage, type VaultStorageAdapter } from '../vaultCore';
import { importRawVaultKey } from '../crypto';
import {
    deriveRecoveryUnlockKey,
    deriveUnlockKey,
    openRecord,
    parseAccountKey,
    unwrapAccountKey,
    unwrapAccountKeyWithRecovery,
    unwrapVaultKeyFromCloud,
} from './keys';
import { CloudError, createMemoryCloud, memoryCloudStore, type CloudStore, type MemoryCloud } from './store';

const PRO = '11111111-aaaa-4aaa-8aaa-111111111111';
const FREE = '22222222-bbbb-4bbb-8bbb-222222222222';
const MASTER = 'correct-horse-master-9';

/** Everything a person put in the vault; none of it may ever reach the server readable. */
const SECRETS = ['GitHub', 'sam@acme.test', 'github.com', 'gh-pass-1', 'recovery codes in drawer', 'Chase Sapphire', '4111111111111111', '321', 'FocuzHouse', 'netpw-99', 'Old account', 'old-pass-7', 'Work', 'Finance'];

async function filledVault(storage: VaultStorageAdapter = createMemoryStorage(), session?: VaultStorageAdapter) {
    const vault = new FocuzPassVault(storage, session);
    await vault.setup(MASTER);
    const work = await vault.createVault({ name: 'Work', color: '#4e91da', icon: 'vault' });
    const tag = await vault.createTag({ name: 'Finance', color: '#e0af68', icon: 'tag' });
    await vault.upsert({ type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'gh-pass-1', note: 'recovery codes in drawer', vaultId: work.id });
    await vault.upsert({ type: 'card', title: 'Chase Sapphire', identity: 'Sam Lee', cardNumber: '4111111111111111', expiry: '11/27', cvv: '321', tagIds: [tag.id] });
    await vault.upsert({ type: 'custom', kind: 'wireless_router', title: 'Home Wi-Fi', identity: 'FocuzHouse', fields: { networkName: 'FocuzHouse', password: 'netpw-99' } });
    const old = await vault.upsert({ type: 'login', title: 'Old account', identity: 'sam', password: 'old-pass-7' });
    await vault.itemAction({ action: 'trash', id: old.id });
    return { vault, storage };
}

function world() {
    const cloud = createMemoryCloud();
    cloud.users.set(PRO, { email: 'sam@acme.test', pro: true });
    cloud.users.set(FREE, { email: 'free@acme.test', pro: false });
    let signedIn: string | null = PRO;
    const store = memoryCloudStore(cloud, () => signedIn);
    return { cloud, store, signIn: (id: string | null) => (signedIn = id) };
}

/** Opens everything in a copy of the database, the way a new device would. */
async function openDump(cloud: MemoryCloud, userId: string, unlock: { password: string; secretKey: string } | { recoveryKey: string }) {
    const account = cloud.accounts.get(userId)!;
    const accountKey =
        'recoveryKey' in unlock
            ? await unwrapAccountKeyWithRecovery(await deriveRecoveryUnlockKey(unlock.recoveryKey, userId), account.recovery_wrapped_account_key!, userId)
            : await unwrapAccountKey(await deriveUnlockKey(unlock.password, unlock.secretKey, userId, account), account.wrapped_account_key, userId);
    const [key] = [...cloud.keys.values()].filter((k) => k.user_id === userId);
    const vaultKey = await importRawVaultKey(await unwrapVaultKeyFromCloud(accountKey, key!.wrapped_key, userId, key!.id, key!.key_version));
    const opened: Record<string, unknown>[] = [];
    for (const row of [...cloud.records.values()].filter((r) => r.user_id === userId)) {
        const meta = { userId, id: row.id, kind: row.kind, revision: row.revision, keyId: row.key_id, keyVersion: row.key_version };
        opened.push(JSON.parse(await openRecord(vaultKey, meta, row)));
    }
    return opened;
}

test('Turning on Cloud sync: the Security Key stays on the device, and only ciphertext is sent', async () => {
    const { vault, storage } = await filledVault();
    const { cloud, store } = world();

    await assert.rejects(vault.prepareCloud('wrong-password-1', { id: PRO, email: 'sam@acme.test' }), /master password/);
    const kit = await vault.prepareCloud(MASTER, { id: PRO, email: 'sam@acme.test' }, { recoveryKey: true });
    assert.match(kit.secretKey, /^A1-/);
    assert.match(kit.recoveryKey ?? '', /^R1-/);
    assert.deepEqual(vault.cloudStatus().state, 'pending');
    assert.equal(cloud.wire.length, 0, 'nothing leaves the device before the upload step');
    const secretKey = parseAccountKey(kit.secretKey, 'secret')!;
    const recoveryKey = parseAccountKey(kit.recoveryKey!, 'recovery')!;
    const onDisk = JSON.stringify(await storage.get(['focuzpass.meta.v1', 'focuzpass.blob.v1']));
    assert.ok(!onDisk.includes(secretKey) && !onDisk.includes(recoveryKey), 'keys are only inside the encrypted vault');

    const progress: number[] = [];
    const { uploaded } = await vault.enableCloud(store, (done) => progress.push(done));
    const snap = vault.snapshot();
    assert.equal(uploaded, snap.items.length + snap.vaults.length + snap.tags.length);
    assert.equal(cloud.records.size, uploaded);
    assert.ok(progress.length > 0);
    assert.equal(vault.cloudStatus().state, 'on');
    assert.deepEqual(cloud.events.map((e) => e.kind), ['cloud_enabled', 'recovery_key_created']);

    const wire = cloud.wire.join('\n');
    for (const secret of [...SECRETS, MASTER, secretKey, kit.secretKey, recoveryKey, kit.recoveryKey!]) {
        assert.ok(!wire.includes(secret), `"${secret}" went over the wire`);
    }
    const account = cloud.accounts.get(PRO)!;
    assert.equal(account.secret_key_id, kit.secretKeyId);
    assert.ok(!JSON.stringify(account).includes(secretKey));
});

test('A copy of the database opens with the master password AND Security Key, or the recovery key; never with one of them', async () => {
    const { vault } = await filledVault();
    const { cloud, store } = world();
    const kit = await vault.prepareCloud(MASTER, { id: PRO }, { recoveryKey: true });
    await vault.enableCloud(store);
    const secretKey = parseAccountKey(kit.secretKey, 'secret')!;

    await assert.rejects(openDump(cloud, PRO, { password: MASTER, secretKey: parseAccountKey(`A1${'0'.repeat(26)}`, 'secret')! }), Error, 'dump + master password alone');
    await assert.rejects(openDump(cloud, PRO, { password: 'guess-guess-guess', secretKey }), Error, 'dump + Security Key alone');

    const restored = await openDump(cloud, PRO, { password: MASTER, secretKey });
    const text = JSON.stringify(restored);
    for (const secret of SECRETS) assert.ok(text.includes(secret), `${secret} comes back from the Emergency Kit + master password`);
    const items = restored.filter((r) => 'item' in r).map((r) => r.item as { title: string; deletedAt?: string });
    assert.ok(items.find((i) => i.title === 'Old account')?.deletedAt, 'the trash comes along, still in the trash');

    const viaRecovery = await openDump(cloud, PRO, { recoveryKey: parseAccountKey(kit.recoveryKey!, 'recovery')! });
    assert.equal(viaRecovery.length, restored.length);
});

test('Free accounts and signed-out devices can\'t upload; the local setup waits', async () => {
    const { vault } = await filledVault();
    const { cloud, store, signIn } = world();
    await vault.prepareCloud(MASTER, { id: FREE });
    signIn(FREE);
    await assert.rejects(vault.enableCloud(store), (e: unknown) => e instanceof CloudError && e.code === 'not-pro');
    assert.equal(vault.cloudStatus().state, 'pending');
    assert.equal(cloud.accounts.size + cloud.keys.size + cloud.records.size, 0);
    signIn(null);
    await assert.rejects(vault.enableCloud(store), (e: unknown) => e instanceof CloudError && e.code === 'signed-out');
    signIn(PRO);
    await assert.rejects(vault.enableCloud(store), /different FocuzNow account/);
    // Nothing went up, so it can be cancelled cleanly.
    assert.equal((await vault.cancelCloud()).state, 'off');
});

test('An interrupted upload carries on where it stopped, without sending anything twice', async () => {
    const { vault } = await filledVault();
    await vault.importItems(Array.from({ length: 450 }, (_, i) => ({ type: 'login' as const, title: `Site ${i}`, identity: `user${i}`, password: `pw-${i}-xyz` })));
    const { cloud, store } = world();
    let batches = 0;
    const flaky: CloudStore = {
        ...store,
        async upsertRecords(rows) {
            await store.upsertRecords(rows);
            // The second batch is saved, but the answer never makes it back.
            if (++batches === 2) throw new CloudError('offline', 'offline');
        },
    };
    await vault.prepareCloud(MASTER, { id: PRO });
    await assert.rejects(vault.enableCloud(flaky), /offline/);
    assert.equal(vault.cloudStatus().state, 'pending');
    assert.equal(vault.cloudStatus().records, 200, 'only the first batch is noted as sent');
    assert.equal(cloud.records.size, 400, 'though two batches landed');

    // The unnoted batch comes back as a conflict on the retry and counts as already there.
    const { uploaded } = await vault.enableCloud(store);
    const snap = vault.snapshot();
    assert.equal(uploaded, snap.items.length + snap.vaults.length + snap.tags.length);
    assert.equal(cloud.records.size, uploaded);
    assert.ok([...cloud.records.values()].every((r) => r.revision === 1), 'each record sent once');
    assert.equal(cloud.accounts.size, 1);
});

test('Cloud sync already on from another device isn\'t overwritten', async () => {
    const { cloud, store } = world();
    const first = (await filledVault()).vault;
    await first.prepareCloud(MASTER, { id: PRO });
    await first.enableCloud(store);
    const second = (await filledVault()).vault;
    await second.prepareCloud(MASTER, { id: PRO });
    await assert.rejects(second.enableCloud(store), (e: unknown) => e instanceof CloudError && e.code === 'exists');
    assert.equal(cloud.accounts.get(PRO)?.secret_key_id, first.cloudStatus().secretKeyId);
});

test('A new master password reaches the cloud copy; the old one stops opening it', async () => {
    const storage = createMemoryStorage();
    const session = createMemoryStorage();
    const { vault } = await filledVault(storage, session);
    const { cloud, store } = world();
    const kit = await vault.prepareCloud(MASTER, { id: PRO });
    await vault.enableCloud(store);
    const secretKey = parseAccountKey(kit.secretKey, 'secret')!;

    await vault.changeMasterPassword(MASTER, 'brand-new-master-7');
    assert.equal(vault.cloudStatus().accountPending, true, 'waits to be sent');
    assert.equal(await vault.syncCloudAccount(store), true);
    assert.equal(vault.cloudStatus().accountPending, undefined);
    assert.equal(cloud.accounts.get(PRO)?.revision, 2);
    assert.ok(cloud.events.some((e) => e.kind === 'password_changed'));

    await assert.rejects(openDump(cloud, PRO, { password: MASTER, secretKey }));
    assert.ok((await openDump(cloud, PRO, { password: 'brand-new-master-7', secretKey })).length > 0);

    // Cloud state survives locking, unlocking and a worker restart.
    vault.lock();
    await vault.unlock('brand-new-master-7');
    assert.equal(vault.cloudStatus().state, 'on');
    const restarted = new FocuzPassVault(storage, session);
    assert.equal(await restarted.restoreFromSession(), true);
    assert.equal(restarted.cloudStatus().secretKeyId, kit.secretKeyId);
});

test('The Emergency Kit can be shown again, after the master password', async () => {
    const { vault } = await filledVault();
    const { store } = world();
    const kit = await vault.prepareCloud(MASTER, { id: PRO, email: 'sam@acme.test' });
    await vault.enableCloud(store);
    await assert.rejects(vault.cloudKit('not-my-password'), /master password/);
    assert.deepEqual(await vault.cloudKit(MASTER), { secretKey: kit.secretKey, secretKeyId: kit.secretKeyId, email: 'sam@acme.test' });
    // Once the cloud copy exists, "cancel" doesn't pull the keys out from under it.
    assert.equal((await vault.cancelCloud()).state, 'on');
});

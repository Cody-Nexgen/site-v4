import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FocuzPassVault, createMemoryStorage, type VaultStorageAdapter } from './vaultCore';
import type { VaultBlob, VaultMeta } from './types';

const META = 'focuzpass.meta.v1';
const BLOB = 'focuzpass.blob.v1';
const BACKUP = 'focuzpass.upgrade-backup';

/** A vault written by the version before the key hierarchy (see fixtures/vault-v1.json). */
const fixture = JSON.parse(readFileSync(new URL('./fixtures/vault-v1.json', import.meta.url), 'utf8')) as {
    password: string;
    storage: Record<string, unknown>;
};

async function v1Storage() {
    const storage = createMemoryStorage();
    await storage.set(structuredClone(fixture.storage));
    return storage;
}

const read = async (storage: VaultStorageAdapter) => {
    const data = await storage.get([META, BLOB, BACKUP]);
    return { meta: data[META] as VaultMeta, blob: data[BLOB] as VaultBlob, backup: data[BACKUP] };
};

/** What a person sees: titles and secrets, without ids or timestamps. */
const contents = (vault: FocuzPassVault) =>
    vault
        .snapshot()
        .items.map((i) => [i.title, i.identity, i.deletedAt ? 'trash' : '', i.type === 'login' ? i.password : i.type === 'card' ? `${i.cardNumber}/${i.cvv}` : i.type === 'custom' ? JSON.stringify(i.fields) : '', i.note ?? ''].join('|'))
        .sort();

test('A new vault wraps a random vault key with the master password', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('first-master-pw-1');
    const { meta } = await read(storage);
    assert.ok(meta.wrappedKey, 'wrapped key');
    assert.equal(meta.verifier, undefined, 'no password-derived key on disk');
    await vault.upsert({ type: 'login', title: 'GitHub', identity: 'sam', password: 'gh-pass-1' });
    vault.lock();
    await assert.rejects(vault.unlock('wrong-master-pw'), /Incorrect master password/);
    await vault.unlock('first-master-pw-1');
    const first = vault.list()[0];
    assert.equal(first?.type === 'login' && first.password, 'gh-pass-1');
});

test('An older vault moves to the key hierarchy on unlock, with every item intact', async () => {
    const storage = await v1Storage();
    const before = await read(storage);
    assert.ok(before.meta.verifier && !before.meta.wrappedKey, 'fixture is the old format');

    const vault = new FocuzPassVault(storage);
    await vault.unlock(fixture.password);
    const opened = contents(vault);
    assert.equal(opened.length, 5);
    assert.ok(opened.some((row) => row.startsWith('GitHub|sam@acme.test||gh-pass-1|recovery codes in drawer')));
    assert.ok(opened.some((row) => row.includes('4111111111111111/321')));
    assert.ok(opened.some((row) => row.includes('netpw-99')));

    const after = await read(storage);
    assert.ok(after.meta.wrappedKey, 'upgraded');
    assert.equal(after.meta.verifier, undefined);
    assert.notEqual(after.meta.salt, before.meta.salt, 'fresh salt');
    assert.notEqual(after.blob.ct, before.blob.ct, 're-encrypted with the new vault key');
    assert.equal(after.backup, undefined, 'the old copy is gone once the new one checked out');
    const raw = JSON.stringify(await storage.get([META, BLOB]));
    for (const secret of ['gh-pass-1', '4111111111111111', 'netpw-99', 'recovery codes']) assert.ok(!raw.includes(secret), secret);

    // Opens again, the new way, with the same password; the vault and tag layout survived.
    vault.lock();
    await assert.rejects(vault.unlock('not-the-password'), /Incorrect master password/);
    await vault.unlock(fixture.password);
    assert.deepEqual(contents(vault), opened);
    const snap = vault.snapshot();
    assert.equal(snap.vaults.find((v) => v.id === snap.items.find((i) => i.title === 'GitHub')?.vaultId)?.name, 'Work');
    assert.equal(snap.tags.find((t) => snap.items.find((i) => i.title === 'Chase')?.tagIds.includes(t.id))?.name, 'Finance');
});

test('If the upgrade can\'t be saved, the vault stays exactly as it was and opens as before', async () => {
    const storage = await v1Storage();
    const before = await read(storage);
    const set = storage.set.bind(storage);
    storage.set = async (items) => {
        if (META in items && (items[META] as VaultMeta).wrappedKey) throw new Error('disk full');
        return set(items);
    };
    const vault = new FocuzPassVault(storage);
    await vault.unlock(fixture.password);
    assert.equal(contents(vault).length, 5, 'unlock still works');
    const after = await read(storage);
    assert.deepEqual(after.meta, before.meta);
    assert.equal(after.blob.ct, before.blob.ct);
    assert.equal(after.backup, undefined);
    // Still saves in the old format meanwhile, and upgrades on a later unlock.
    await vault.upsert({ type: 'login', title: 'Figma', identity: 'sam', password: 'fg-pass-2' });
    storage.set = set;
    vault.lock();
    await vault.unlock(fixture.password);
    assert.ok((await read(storage)).meta.wrappedKey);
    assert.equal(contents(vault).length, 6);
});

test('If the upgraded copy doesn\'t read back, the old one is put back', async () => {
    const storage = await v1Storage();
    const before = await read(storage);
    const set = storage.set.bind(storage);
    storage.set = async (items) => {
        if (META in items && BLOB in items && (items[META] as VaultMeta).wrappedKey) {
            // The write "succeeds" but what lands on disk is damaged.
            const blob = items[BLOB] as VaultBlob;
            return set({ ...items, [BLOB]: { ...blob, ct: blob.ct.slice(0, -8) + 'AAAAAAAA' } });
        }
        return set(items);
    };
    const vault = new FocuzPassVault(storage);
    await vault.unlock(fixture.password);
    const after = await read(storage);
    assert.deepEqual(after.meta, before.meta, 'old meta restored');
    assert.equal(after.blob.ct, before.blob.ct, 'old blob restored');
    assert.equal(after.backup, undefined);
    storage.set = set;
    vault.lock();
    await vault.unlock(fixture.password);
    assert.equal(contents(vault).length, 5);
});

test('An upgrade cut off before its check is recovered from the copy it kept', async () => {
    const storage = await v1Storage();
    const before = await read(storage);
    // As if the browser closed between writing the new format and checking it, and the new
    // blob is unreadable: the old meta + blob are still in the backup slot.
    await storage.set({
        [BACKUP]: { meta: before.meta, blob: before.blob },
        [META]: { ...before.meta, verifier: undefined, wrappedKey: { iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA' } },
    });
    const vault = new FocuzPassVault(storage);
    // The damaged wrapped key reads as a wrong password; the kept copy still opens.
    await assert.rejects(vault.unlock(fixture.password), /Incorrect master password/);
    await storage.set({ [META]: before.meta, [BLOB]: { ...before.blob, ct: 'AAAA' } });
    await vault.unlock(fixture.password);
    assert.equal(contents(vault).length, 5);
    const after = await read(storage);
    assert.ok(after.meta.wrappedKey, 'and then upgraded properly');
    assert.equal(after.backup, undefined);
});

test('Changing the master password re-wraps the key: old one stops working, nothing re-encrypted', async () => {
    const storage = await v1Storage();
    const vault = new FocuzPassVault(storage);
    await vault.unlock(fixture.password);
    const before = await read(storage);
    const items = contents(vault);

    await assert.rejects(vault.changeMasterPassword('wrong-current-pw', 'brand-new-master-9'), /current master password/);
    await assert.rejects(vault.changeMasterPassword(fixture.password, 'short'), /at least 8/);
    await assert.rejects(vault.changeMasterPassword(fixture.password, fixture.password), /different/);
    assert.deepEqual((await read(storage)).meta, before.meta, 'refused changes leave it alone');

    await vault.changeMasterPassword(fixture.password, 'brand-new-master-9');
    const after = await read(storage);
    assert.equal(after.blob.ct, before.blob.ct, 'items untouched');
    assert.notEqual(after.meta.salt, before.meta.salt);
    assert.notDeepEqual(after.meta.wrappedKey, before.meta.wrappedKey);
    assert.deepEqual(contents(vault), items, 'still unlocked and the same');

    vault.lock();
    await assert.rejects(vault.unlock(fixture.password), /Incorrect master password/);
    await vault.unlock('brand-new-master-9');
    assert.deepEqual(contents(vault), items);
});

test('Changing the password on a vault that hadn\'t upgraded yet upgrades it too', async () => {
    const storage = await v1Storage();
    const set = storage.set.bind(storage);
    let block = true;
    storage.set = async (items) => {
        if (block && META in items && (items[META] as VaultMeta).wrappedKey) throw new Error('disk full');
        return set(items);
    };
    const vault = new FocuzPassVault(storage);
    await vault.unlock(fixture.password);
    assert.ok((await read(storage)).meta.verifier, 'still the old format');
    block = false;
    await vault.changeMasterPassword(fixture.password, 'brand-new-master-9');
    const { meta } = await read(storage);
    assert.ok(meta.wrappedKey && !meta.verifier);
    vault.lock();
    await assert.rejects(vault.unlock(fixture.password));
    await vault.unlock('brand-new-master-9');
    assert.equal(contents(vault).length, 5);
});

test('Backup files: new ones carry the wrapped key; old ones and pre-change ones still open', async () => {
    const source = new FocuzPassVault(await v1Storage());
    await source.unlock(fixture.password);
    const pkg = await source.exportPackage();
    assert.equal(pkg.version, 2);
    assert.ok(pkg.wrappedKey && !pkg.verifier);
    await source.changeMasterPassword(fixture.password, 'brand-new-master-9');
    const pkgAfter = await source.exportPackage();

    const target = new FocuzPassVault(createMemoryStorage());
    await target.setup('target-master-pw-3');
    await assert.rejects(target.importPackage(pkg, 'brand-new-master-9'), /master password/);
    assert.deepEqual(await target.importPackage(pkg, fixture.password), { added: 4, duplicates: 0, failed: 0 });
    assert.deepEqual(await target.importPackage(pkgAfter, 'brand-new-master-9'), { added: 0, duplicates: 4, failed: 0 });

    // A backup made by the previous version (the password-derived key encrypts the data).
    const old = fixture.storage[META] as VaultMeta;
    const v1Package = {
        format: 'focuzpass-export',
        version: 1,
        createdAt: '2026-09-28T00:00:00.000Z',
        itemCount: 4,
        kdf: old.kdf,
        iterations: old.iterations,
        salt: old.salt,
        verifier: old.verifier,
        data: fixture.storage[BLOB],
    };
    const fresh = new FocuzPassVault(createMemoryStorage());
    await fresh.setup('fresh-master-pw-4');
    assert.deepEqual(await fresh.importPackage(v1Package, fixture.password), { added: 4, duplicates: 0, failed: 0 });
});

test('After the upgrade, a restarted worker restores the unlocked vault from the session', async () => {
    const storage = await v1Storage();
    const session = createMemoryStorage();
    const vault = new FocuzPassVault(storage, session);
    await vault.unlock(fixture.password);
    const items = contents(vault);
    const restarted = new FocuzPassVault(storage, session);
    assert.equal(await restarted.restoreFromSession(), true);
    assert.deepEqual(contents(restarted), items);
    await restarted.upsert({ type: 'login', title: 'Figma', identity: 'sam', password: 'fg-pass-2' });
    restarted.lock();
    await restarted.unlock(fixture.password);
    assert.equal(contents(restarted).length, 6);
});

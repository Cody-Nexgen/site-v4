import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import test from 'node:test';
import { FOCUZPASS_STORAGE_BLOB, FOCUZPASS_STORAGE_META } from './types';
import { FocuzPassVault, createMemoryStorage } from './vaultCore';

/**
 * The iPhone app has to open vaults made here, byte for byte. This makes a small vault with a test
 * master password; with FOCUZPASS_IOS_FIXTURE=<path> it also writes it out for the Swift tests
 * (ios/FocuzNowKit/Tests/FocuzNowKitTests/Fixtures/vault-v1.json).
 */
test('A vault for the iOS crypto tests opens again here', async () => {
    const masterPassword = 'fixture-master-password ✓ 2026';
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup(masterPassword);
    const expect = [
        { title: 'GitHub', identity: 'maya@focuznow.com', domain: 'github.com', password: 'Gh-Secret!42 ünïcødé', note: 'two-factor on' },
        { title: 'Linear', identity: 'maya', domain: 'linear.app', password: 'linear-pass-9000', note: '' },
    ];
    for (const item of expect) {
        await vault.upsert({ type: 'login', title: item.title, identity: item.identity, domain: item.domain, password: item.password, note: item.note || undefined });
    }
    const stored = await storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB]);
    vault.lock();
    await vault.unlock(masterPassword);
    assert.equal(vault.snapshot().items.length, 2);
    const out = process.env.FOCUZPASS_IOS_FIXTURE;
    if (out) {
        writeFileSync(out, `${JSON.stringify({ masterPassword, meta: stored[FOCUZPASS_STORAGE_META], blob: stored[FOCUZPASS_STORAGE_BLOB], expect }, null, 2)}\n`);
    }
});

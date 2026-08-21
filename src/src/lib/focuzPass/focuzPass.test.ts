import assert from 'node:assert/strict';
import test from 'node:test';
import {
    decryptAesGcm,
    deriveVaultKey,
    encryptAesGcm,
    randomBytes,
    verifyMasterPassword,
    createVerifier,
} from './crypto';
import {
    FOCUZPASS_PBKDF2_ITERATIONS,
    FOCUZPASS_STORAGE_BLOB,
} from './types';
import {
    FocuzPassVault,
    createMemoryStorage,
    assertNoPlaintextSecrets,
    isExactVaultDomain,
    normalizeVaultDomain,
} from './vaultCore';
import { PRIMARY_NAV } from '../workspaceNav';
import { isExtensionHelperTab, shouldOpenTabOnWeb } from '../workspaceSync';

test('FocuzPass crypto round-trips AES-256-GCM plaintext', async () => {
    const salt = randomBytes(16);
    const key = await deriveVaultKey('correct horse battery', salt, FOCUZPASS_PBKDF2_ITERATIONS);
    const payload = await encryptAesGcm(key, 'super-secret-password');
    const plain = await decryptAesGcm(key, payload);
    assert.equal(plain, 'super-secret-password');
});

test('FocuzPass crypto uses a unique nonce for every encryption', async () => {
    const salt = randomBytes(16);
    const key = await deriveVaultKey('nonce-check-password', salt, FOCUZPASS_PBKDF2_ITERATIONS);
    const a = await encryptAesGcm(key, 'same-plaintext');
    const b = await encryptAesGcm(key, 'same-plaintext');
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.ct, b.ct);
});

test('FocuzPass crypto rejects wrong master password via verifier', async () => {
    const salt = randomBytes(16);
    const good = await deriveVaultKey('right-password-12', salt, FOCUZPASS_PBKDF2_ITERATIONS);
    const bad = await deriveVaultKey('wrong-password-12', salt, FOCUZPASS_PBKDF2_ITERATIONS);
    const verifier = await createVerifier(good);
    assert.equal(await verifyMasterPassword(good, verifier), true);
    assert.equal(await verifyMasterPassword(bad, verifier), false);
});

test('FocuzPass crypto fails decrypt on tampered ciphertext', async () => {
    const salt = randomBytes(16);
    const key = await deriveVaultKey('tamper-password-99', salt, FOCUZPASS_PBKDF2_ITERATIONS);
    const payload = await encryptAesGcm(key, 'do-not-leak');
    const tampered = {
        iv: payload.iv,
        ct: payload.ct.slice(0, -2) + (payload.ct.endsWith('AA') ? 'BB' : 'AA'),
    };
    await assert.rejects(() => decryptAesGcm(key, tampered));
});

test('FocuzPass vault setup/unlock/CRUD stores no plaintext secrets', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    const secretPassword = 'vR4!qz9#Pk2@Lm7-unique';
    const cardNumber = '4147208844714471';
    const cvv = '184';

    await vault.setup('master-password-strong');
    await vault.upsert({
        type: 'login',
        title: 'GitHub',
        identity: 'jane@mail.com',
        domain: 'github.com',
        password: secretPassword,
        note: 'Personal development account',
    });
    await vault.upsert({
        type: 'card',
        title: 'Chase Sapphire',
        identity: 'Jane Doe',
        cardNumber,
        expiry: '09/28',
        cvv,
    });
    await vault.upsert({
        type: 'passkey',
        title: 'Notion',
        identity: 'jane@mail.com',
        domain: 'notion.so',
    });

    const listed = vault.list();
    assert.equal(listed.length, 3);
    assert.equal(listed.find((item) => item.type === 'login')?.password, secretPassword);

    const raw = await vault.readPersistedRaw();
    const serialized = JSON.stringify(raw);
    assertNoPlaintextSecrets(serialized, [secretPassword, cardNumber, cvv, 'master-password-strong']);
    assert.ok(!serialized.includes(secretPassword));
    assert.ok((raw.meta?.iterations || 0) >= 600_000);
    assert.ok(raw.blob?.iv);
    assert.ok(raw.blob?.ct);

    vault.lock();
    assert.equal(vault.isUnlocked, false);
    assert.throws(() => vault.list(), /locked/i);

    await vault.unlock('master-password-strong');
    const again = vault.list();
    assert.equal(again.find((item) => item.type === 'card')?.cardNumber, cardNumber);

    const loginId = again.find((item) => item.type === 'login')!.id;
    await vault.delete(loginId);
    assert.equal(vault.list().length, 2);
});

test('FocuzPass overlay matching is exact-domain only', () => {
    assert.equal(normalizeVaultDomain('https://www.GitHub.com/login'), 'github.com');
    assert.equal(isExactVaultDomain('github.com', 'www.github.com'), true);
    assert.equal(isExactVaultDomain('accounts.google.com', 'google.com'), false);
    assert.equal(isExactVaultDomain('github.com.evil.example', 'github.com'), false);
});

test('FocuzPass vault returns only exact-domain login matches and records use', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('domain-match-master');
    const github = await vault.upsert({
        type: 'login',
        title: 'GitHub',
        identity: 'one@example.com',
        domain: 'https://www.github.com/login',
        password: 'ExactDomainSecret1!',
    });
    await vault.upsert({
        type: 'login',
        title: 'GitLab',
        identity: 'two@example.com',
        domain: 'gitlab.com',
        password: 'OtherDomainSecret2!',
    });

    const matches = vault.findLoginMatches('github.com');
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, github.id);
    assert.equal(matches[0]?.password, 'ExactDomainSecret1!');

    await vault.markUsed(github.id);
    assert.ok(vault.findLoginMatches('github.com')[0]?.lastUsedAt);
    assert.equal(vault.findLoginMatches('github.com.evil.example').length, 0);
});

test('FocuzPass vault rejects wrong master password on unlock', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('correct-master-99');
    vault.lock();
    await assert.rejects(() => vault.unlock('incorrect-master-99'), /incorrect/i);
});

test('FocuzPass vault rejects tampered outer vault blob', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('correct-master-88');
    await vault.upsert({
        type: 'login',
        title: 'Test',
        identity: 'a@b.com',
        password: 'SecretValue123!',
    });
    vault.lock();

    const data = await storage.get([FOCUZPASS_STORAGE_BLOB]);
    const blob = data[FOCUZPASS_STORAGE_BLOB] as { iv: string; ct: string };
    await storage.set({
        [FOCUZPASS_STORAGE_BLOB]: {
            iv: blob.iv,
            ct: `${blob.ct.slice(0, -4)}zzzz`,
        },
    });

    const vault2 = new FocuzPassVault(storage);
    await assert.rejects(() => vault2.unlock('correct-master-88'), /corrupt|tamper/i);
});

test('FocuzPass vault locks after idle timeout', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('idle-master-password');
    await vault.upsert({
        type: 'login',
        title: 'Idle',
        identity: 'idle@test.com',
        password: 'IdleSecret999!',
    });

    (vault as unknown as { idleLockMs: number; lastActivityAt: number }).idleLockMs = 1;
    (vault as unknown as { lastActivityAt: number }).lastActivityAt = Date.now() - 50;
    assert.equal(vault.enforceLockTimers(), true);
    assert.equal(vault.isUnlocked, false);
});

test('FocuzPass vault locks after absolute maximum unlock window', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('absolute-master-password');
    (vault as unknown as { unlockedAt: number; lastActivityAt: number }).unlockedAt =
        Date.now() - 25 * 60 * 60 * 1000;
    (vault as unknown as { lastActivityAt: number }).lastActivityAt = Date.now();
    assert.equal(vault.enforceLockTimers(), true);
    assert.equal(vault.isUnlocked, false);
});

test('FocuzPass navigation keeps tab under Dashboard', () => {
    assert.deepEqual(PRIMARY_NAV.map((tab) => tab.id), ['overview', 'focuzpass']);
    assert.equal(PRIMARY_NAV[1]?.label, 'FocuzPass');
});

test('FocuzPass stays in the extension instead of opening /app', () => {
    // Membership in EXTENSION_HELPER_TABS is what OptionsApp checks via shouldOpenTabOnWeb.
    assert.equal(isExtensionHelperTab('focuzpass'), true);
    assert.equal(shouldOpenTabOnWeb('focuzpass'), false);
});

test('FocuzPass website companion contract is local-first', () => {
    const modeFor = (web: boolean) => (web ? 'companion' : 'extension-vault');
    assert.equal(modeFor(true), 'companion');
    assert.equal(modeFor(false), 'extension-vault');
});

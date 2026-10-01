import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deriveRecoveryUnlockKey,
    deriveUnlockKey,
    formatAccountKey,
    newAccountKdf,
    newAccountKey,
    openRecord,
    parseAccountKey,
    recordIdFor,
    sealRecord,
    unwrapAccountKey,
    unwrapAccountKeyWithRecovery,
    unwrapVaultKeyFromCloud,
    wrapAccountKey,
    wrapAccountKeyForRecovery,
    wrapVaultKeyForCloud,
    type RecordMeta,
} from './keys';
import { importRawVaultKey, newVaultKeyBytes } from '../crypto';

const USER = '5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER = '6a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d';
const FAST = 100_000; // fewer PBKDF2 rounds keep the tests quick; the real setting is 600k

test('Security Key and recovery key: 130 random bits, readable, typo-tolerant', () => {
    const key = newAccountKey('secret');
    assert.match(key, /^A1[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.match(newAccountKey('recovery'), /^R1[0-9A-HJKMNP-TV-Z]{26}$/);
    const shown = formatAccountKey(key);
    assert.match(shown, /^A1-\w{6}-\w{5}-\w{5}-\w{5}-\w{5}$/);
    assert.equal(parseAccountKey(shown, 'secret'), key);
    assert.equal(parseAccountKey(` ${shown.toLowerCase()} `, 'secret'), key, 'case and spaces');
    assert.equal(parseAccountKey(key.replace(/0/g, 'O').replace(/1/g, 'l'), 'secret'), key, 'O/0 and l/1 mix-ups');
    assert.equal(parseAccountKey(shown, 'recovery'), null, 'the wrong kind of key');
    assert.equal(parseAccountKey(shown.slice(0, -1), 'secret'), null, 'too short');
    assert.equal(parseAccountKey(shown.slice(0, -1) + 'U', 'secret'), null, 'U isn\'t in the alphabet');
    assert.equal(new Set(Array.from({ length: 200 }, () => newAccountKey('secret'))).size, 200);
});

test('The account key opens only with the master password AND the Security Key, for this account', async () => {
    const secretKey = newAccountKey('secret');
    const kdf = newAccountKdf(FAST);
    const accountKey = newVaultKeyBytes();
    const wrapped = await wrapAccountKey(await deriveUnlockKey('master-pw-one', secretKey, USER, kdf), accountKey, USER);

    assert.deepEqual(await unwrapAccountKey(await deriveUnlockKey('master-pw-one', secretKey, USER, kdf), wrapped, USER), accountKey);
    const refused = async (password: string, key: string, user: string, k = kdf) =>
        assert.rejects(async () => unwrapAccountKey(await deriveUnlockKey(password, key, user, k), wrapped, user));
    await refused('master-pw-two', secretKey, USER); // right Security Key, wrong password
    await refused('master-pw-one', newAccountKey('secret'), USER); // right password, wrong Security Key
    await refused('master-pw-one', secretKey, OTHER); // both right, another account
    await refused('master-pw-one', secretKey, USER, { ...kdf, salt: newAccountKdf(FAST).salt }); // another salt
});

test('A recovery key opens the account key on its own; the Security Key alone doesn\'t', async () => {
    const recoveryKey = newAccountKey('recovery');
    const accountKey = newVaultKeyBytes();
    const wrapped = await wrapAccountKeyForRecovery(await deriveRecoveryUnlockKey(recoveryKey, USER), accountKey, USER);
    assert.deepEqual(await unwrapAccountKeyWithRecovery(await deriveRecoveryUnlockKey(recoveryKey, USER), wrapped, USER), accountKey);
    await assert.rejects(async () => unwrapAccountKeyWithRecovery(await deriveRecoveryUnlockKey(newAccountKey('recovery'), USER), wrapped, USER));
    await assert.rejects(async () => unwrapAccountKeyWithRecovery(await deriveRecoveryUnlockKey(recoveryKey, OTHER), wrapped, OTHER));
});

test('A vault key wrapped for the cloud is bound to its account, key id and version', async () => {
    const accountKey = newVaultKeyBytes();
    const vaultKey = newVaultKeyBytes();
    const keyId = crypto.randomUUID();
    const wrapped = await wrapVaultKeyForCloud(accountKey, vaultKey, USER, keyId, 1);
    assert.deepEqual(await unwrapVaultKeyFromCloud(accountKey, wrapped, USER, keyId, 1), vaultKey);
    await assert.rejects(unwrapVaultKeyFromCloud(accountKey, wrapped, USER, crypto.randomUUID(), 1));
    await assert.rejects(unwrapVaultKeyFromCloud(accountKey, wrapped, USER, keyId, 2));
    await assert.rejects(unwrapVaultKeyFromCloud(accountKey, wrapped, OTHER, keyId, 1));
    await assert.rejects(unwrapVaultKeyFromCloud(newVaultKeyBytes(), wrapped, USER, keyId, 1));
});

test('A sealed record opens only as the record it was sealed as', async () => {
    const key = await importRawVaultKey(newVaultKeyBytes());
    const meta: RecordMeta = { userId: USER, id: crypto.randomUUID(), kind: 'item', revision: 3, keyId: crypto.randomUUID(), keyVersion: 1 };
    const sealed = await sealRecord(key, meta, '{"title":"GitHub","password":"gh-pass-1"}');
    assert.ok(!sealed.ciphertext.includes('gh-pass'));
    assert.equal(await openRecord(key, meta, sealed), '{"title":"GitHub","password":"gh-pass-1"}');
    for (const moved of [
        { userId: OTHER }, // copied into another account
        { id: crypto.randomUUID() }, // copied to another record
        { kind: 'tag' as const }, // passed off as another kind
        { revision: 2 }, // an old revision replayed as this one
        { keyId: crypto.randomUUID() },
        { keyVersion: 2 },
    ]) {
        await assert.rejects(openRecord(key, { ...meta, ...moved }, sealed), `refuses ${Object.keys(moved)[0]}`);
    }
});

test('Record ids: UUIDs stay; other local ids map to a stable UUID per kind', async () => {
    const uuid = crypto.randomUUID();
    assert.equal(await recordIdFor('item', uuid.toUpperCase()), uuid);
    const personal = await recordIdFor('collection', 'focuzpass-personal');
    assert.match(personal, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(await recordIdFor('collection', 'focuzpass-personal'), personal, 'same on every device');
    assert.notEqual(await recordIdFor('tag', 'focuzpass-personal'), personal);
});

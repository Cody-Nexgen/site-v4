import assert from 'node:assert/strict';
import test from 'node:test';
import { FocuzPassVault, createMemoryStorage, type DecryptedVaultItem } from '../vaultCore';
import { createMemoryCloud, memoryCloudStore } from '../cloud/store';
import { ES256, PasskeyError, derToRaw, fromBase64Url, toBase64Url, type CreationOptionsJSON, type RegistrationResponseJSON } from './webauthn';

const MASTER = 'correct-horse-master-9';
const USER = '11111111-aaaa-4aaa-8aaa-111111111111';
const ORIGIN = 'https://github.com';

const challenge = () => toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
const creation = (userId = 'gh-user-1', name = 'sam@acme.test'): CreationOptionsJSON => ({
    rp: { id: 'github.com', name: 'GitHub' },
    user: { id: toBase64Url(new TextEncoder().encode(userId)), name, displayName: 'Sam' },
    challenge: challenge(),
    pubKeyCredParams: [{ type: 'public-key', alg: ES256 }],
});

/** Verifies a sign-in the way github.com would, with the public key it got at registration. */
async function verifies(registration: RegistrationResponseJSON, assertion: { response: { authenticatorData: string; clientDataJSON: string; signature: string } }) {
    const key = await crypto.subtle.importKey('spki', fromBase64Url(registration.response.publicKey) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const clientData = fromBase64Url(assertion.response.clientDataJSON);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientData as BufferSource));
    const signed = Uint8Array.from([...fromBase64Url(assertion.response.authenticatorData), ...hash]);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(fromBase64Url(assertion.response.signature)) as BufferSource, signed as BufferSource);
}

const passkeys = (vault: FocuzPassVault) => vault.snapshot().items.filter((i): i is Extract<DecryptedVaultItem, { type: 'passkey' }> => i.type === 'passkey');

test('A passkey saved in FocuzPass: encrypted at rest, and it signs in after a restart', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup(MASTER);
    const registration = await vault.passkeyCreate(ORIGIN, creation());
    const [item] = passkeys(vault);
    assert.equal(item?.domain, 'github.com');
    assert.equal(item?.identity, 'sam@acme.test');
    assert.equal(item?.title, 'GitHub');
    assert.equal(item?.credentialId, registration.id);

    const onDisk = JSON.stringify(await storage.get(['focuzpass.meta.v1', 'focuzpass.blob.v1']));
    assert.ok(!onDisk.includes(item!.passkey!.privateKey.d!), 'the private key is never stored readable');

    vault.lock();
    await vault.unlock(MASTER);
    const options = { challenge: challenge(), rpId: 'github.com' };
    assert.deepEqual(vault.passkeyPreflight(ORIGIN, { op: 'get', options }).accounts.map((a) => a.userName), ['sam@acme.test']);
    const assertion = await vault.passkeyGet(ORIGIN, options, registration.id);
    assert.equal(await verifies(registration, assertion), true);
    assert.ok(passkeys(vault)[0]?.lastUsedAt);
});

test('Passkey rules: other sites get nothing, excluded ones refuse, same account replaces, copies carry no key', async () => {
    const vault = new FocuzPassVault(createMemoryStorage());
    await vault.setup(MASTER);
    const first = await vault.passkeyCreate(ORIGIN, creation());

    await assert.rejects(vault.passkeyGet('https://github.com.evil.io', { challenge: challenge(), rpId: 'github.com' }, first.id), (e: unknown) => e instanceof PasskeyError && e.name === 'SecurityError');
    assert.throws(() => vault.passkeyPreflight('https://evil.io', { op: 'get', options: { challenge: challenge(), rpId: 'github.com' } }), /another site/);
    assert.deepEqual(vault.passkeyPreflight('https://gist.github.com', { op: 'get', options: { challenge: challenge(), rpId: 'gist.github.com' } }).accounts, [], 'a subdomain rpId is a different site');

    await assert.rejects(vault.passkeyCreate(ORIGIN, { ...creation('gh-user-2', 'other'), excludeCredentials: [{ id: first.id, type: 'public-key' }] }), (e: unknown) => e instanceof PasskeyError && e.name === 'InvalidStateError');

    const second = await vault.passkeyCreate(ORIGIN, creation());
    assert.equal(passkeys(vault).length, 1, 'same account on the same site: the new passkey replaces the old');
    assert.equal(passkeys(vault)[0]?.credentialId, second.id);
    await assert.rejects(vault.passkeyGet(ORIGIN, { challenge: challenge(), rpId: 'github.com' }, first.id), (e: unknown) => e instanceof PasskeyError && e.name === 'NotAllowedError');

    const item = passkeys(vault)[0]!;
    await vault.upsert({ id: item.id, type: 'passkey', title: 'GitHub (work)', identity: item.identity, domain: item.domain });
    assert.equal(passkeys(vault)[0]?.passkey?.credentialId, second.id, 'renaming keeps the key');
    const copy = await vault.itemAction({ action: 'duplicate', id: item.id });
    assert.equal((copy as Extract<DecryptedVaultItem, { type: 'passkey' }>).passkey, undefined);

    await vault.itemAction({ action: 'trash', id: item.id });
    assert.deepEqual(vault.passkeyPreflight(ORIGIN, { op: 'get', options: { challenge: challenge(), rpId: 'github.com' } }).accounts, [], 'trashed passkeys aren\'t offered');
});

test('A passkey made on one device signs in on another after sync', async () => {
    const cloud = createMemoryCloud();
    cloud.users.set(USER, { email: 'sam@acme.test', pro: true });
    const store = memoryCloudStore(cloud, () => USER);
    const a = new FocuzPassVault(createMemoryStorage());
    await a.setup(MASTER);
    const kit = await a.prepareCloud(MASTER, { id: USER, email: 'sam@acme.test' });
    await a.enableCloud(store);

    const registration = await a.passkeyCreate(ORIGIN, creation());
    await a.syncCloud(store);
    const secret = passkeys(a)[0]!.passkey!;
    assert.ok(!cloud.wire.join('\n').includes(secret.privateKey.d!), 'the private key only travels sealed');

    const b = new FocuzPassVault(createMemoryStorage());
    await b.joinCloud(store, { masterPassword: MASTER, secretKey: kit.secretKey });
    const assertion = await b.passkeyGet(ORIGIN, { challenge: challenge(), rpId: 'github.com' }, registration.id);
    assert.equal(await verifies(registration, assertion), true);
    const flags = fromBase64Url(assertion.response.authenticatorData)[32]!;
    assert.equal(flags & 0x18, 0x18, 'backup eligible and backed up while Cloud sync is on');

    // Deleted on B for good: A can't use it after syncing either.
    await b.itemAction({ action: 'purge', id: passkeys(b)[0]!.id });
    await b.syncCloud(store);
    await a.syncCloud(store);
    await assert.rejects(a.passkeyGet(ORIGIN, { challenge: challenge(), rpId: 'github.com' }, registration.id), /anymore/);
});

test('A passkey moved in a transfer package still signs in on the other device', async () => {
    const a = new FocuzPassVault(createMemoryStorage());
    await a.setup(MASTER);
    const registration = await a.passkeyCreate(ORIGIN, creation());
    const pkg = await a.exportPackage();
    assert.ok(!JSON.stringify(pkg).includes(passkeys(a)[0]!.passkey!.privateKey.d!), 'the key only travels encrypted');

    const b = new FocuzPassVault(createMemoryStorage());
    await b.setup('other-master-2');
    const first = await b.importPackage(pkg, MASTER);
    assert.equal(first.added, 1);
    const assertion = await b.passkeyGet(ORIGIN, { challenge: challenge(), rpId: 'github.com' }, registration.id);
    assert.equal(await verifies(registration, assertion), true);
    assert.equal((await b.importPackage(pkg, MASTER)).duplicates, 1, 'importing it again doesn\'t make a second copy');
});

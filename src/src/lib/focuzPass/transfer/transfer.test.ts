import assert from 'node:assert/strict';
import test from 'node:test';
import { FocuzPassVault, createMemoryStorage } from '../vaultCore';
import {
    codeFromText,
    deriveTransferKeys,
    formatTransferCode,
    newTransferCode,
    normalizeTransferCode,
    openPayload,
    sealPayload,
    signMessage,
    transferLink,
    verifyMessage,
} from './code';

async function vaultWith(password: string) {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup(password);
    return { vault, storage };
}

test('Codes: 10 unambiguous characters, forgiving input, link round trip', () => {
    const code = newTransferCode();
    assert.match(code, /^[0-9A-HJKMNP-TV-Z]{10}$/);
    assert.equal(normalizeTransferCode(formatTransferCode(code).toLowerCase()), code);
    assert.equal(normalizeTransferCode('k7q4m-z8tri'), 'K7Q4MZ8TR1'); // I → 1
    assert.equal(normalizeTransferCode('0O0O0-11111'), '0000011111'); // O → 0
    assert.equal(normalizeTransferCode('ABC'), null);
    assert.equal(normalizeTransferCode('ABCDEFGHUU'), null); // U isn't in the alphabet
    assert.equal(codeFromText(transferLink(code)), code);
    assert.equal(codeFromText(`https://focuznow.com/pwcode?c=${code}`), code);
    assert.ok(transferLink(code).includes('#'), 'the code travels in the fragment, not to the server');
});

test('Keys: same code meets on the same channel; messages are signed by side', async () => {
    const code = newTransferCode();
    const a = await deriveTransferKeys(code);
    const b = await deriveTransferKeys(code);
    const other = await deriveTransferKeys(newTransferCode());
    assert.equal(a.channel, b.channel);
    assert.notEqual(a.channel, other.channel);
    assert.ok(!a.channel.includes(code));

    const msg = await signMessage(a, { kind: 'offer', from: 'sender', body: { sdp: 'v=0' } });
    assert.equal(await verifyMessage(b, msg, 'sender'), true);
    assert.equal(await verifyMessage(b, msg, 'receiver'), false, 'wrong side');
    assert.equal(await verifyMessage(other, msg, 'sender'), false, 'wrong code');
    assert.equal(await verifyMessage(b, { ...msg, body: { sdp: 'v=0 evil' } }, 'sender'), false, 'tampered body');
    assert.equal(await verifyMessage(b, { ...msg, at: msg.at - 60 * 60 * 1000 }, 'sender'), false, 'old or re-dated');
});

test('Payload wrap: opens with the same code only', async () => {
    const code = newTransferCode();
    const sealed = await sealPayload(await deriveTransferKeys(code), '{"hello":"world"}');
    assert.equal(await openPayload(await deriveTransferKeys(code), sealed), '{"hello":"world"}');
    await assert.rejects(openPayload(await deriveTransferKeys(newTransferCode()), sealed));
});

test('Package: moves every item to another vault, needs the source master password', async () => {
    const { vault: a } = await vaultWith('source-master-pw-1');
    await a.createVault({ name: 'Work', color: '#fff', icon: 'vault' });
    const tag = await a.createTag({ name: 'Finance', color: '#e0af68', icon: 'tag' });
    const work = a.snapshot().vaults.find((v) => v.name === 'Work')!;
    await a.upsert({ type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'gh-pass-1', vaultId: work.id, favorite: true });
    await a.upsert({ type: 'card', title: 'Chase', identity: 'Sam Lee', cardNumber: '4111111111111111', expiry: '11/27', cvv: '321', tagIds: [tag.id] });
    await a.upsert({ type: 'custom', kind: 'wireless_router', title: 'Home Wi-Fi', identity: 'FocuzHouse', fields: { Password: 'netpw-99' } });
    const trashed = await a.upsert({ type: 'login', title: 'Old', identity: 'x', password: 'y-pass-1' });
    await a.itemAction({ action: 'trash', id: trashed.id });

    const pkg = await a.exportPackage();
    assert.equal(pkg.format, 'focuzpass-export');
    assert.equal(pkg.itemCount, 3, 'deleted items stay behind');
    const serialized = JSON.stringify(pkg);
    for (const secret of ['gh-pass-1', '4111111111111111', 'netpw-99', 'GitHub', 'sam@acme.test']) {
        assert.ok(!serialized.includes(secret), `${secret} is not readable in the package`);
    }

    const { vault: b } = await vaultWith('a-different-pw-22');
    await b.createVault({ name: 'Work', color: '#000', icon: 'vault' });
    await assert.rejects(b.importPackage(pkg, 'wrong-password'), /master password/);
    assert.equal(b.list().length, 0);

    assert.deepEqual(await b.importPackage(pkg, 'source-master-pw-1'), { added: 3, duplicates: 0, failed: 0 });
    const snap = b.snapshot();
    const gh = snap.items.find((i) => i.title === 'GitHub');
    assert.equal(gh?.type === 'login' && gh.password, 'gh-pass-1');
    assert.equal(gh?.favorite, true);
    assert.equal(snap.vaults.find((v) => v.id === gh?.vaultId)?.name, 'Work', 'lands in the vault with the same name');
    const chase = snap.items.find((i) => i.title === 'Chase');
    assert.equal(snap.tags.find((t) => chase?.tagIds.includes(t.id))?.name, 'Finance', 'tags come across by name');
    const wifi = snap.items.find((i) => i.title === 'Home Wi-Fi');
    assert.deepEqual(wifi?.type === 'custom' && wifi.fields, { Password: 'netpw-99' });

    // Doing it again adds nothing.
    assert.deepEqual(await b.importPackage(pkg, 'source-master-pw-1'), { added: 0, duplicates: 3, failed: 0 });
});

test('Package: tampering and weakened settings are refused', async () => {
    const { vault: a } = await vaultWith('source-master-pw-1');
    await a.upsert({ type: 'login', title: 'GitHub', identity: 'sam', password: 'gh-pass-1' });
    const pkg = await a.exportPackage();
    const { vault: b } = await vaultWith('another-pw-333');
    const flipped = pkg.data.ct.slice(0, -4) + (pkg.data.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await assert.rejects(b.importPackage({ ...pkg, data: { ...pkg.data, ct: flipped } }, 'source-master-pw-1'));
    await assert.rejects(b.importPackage({ ...pkg, iterations: 1000 }, 'source-master-pw-1'), /unsafe/);
    await assert.rejects(b.importPackage({ hello: 'world' }, 'source-master-pw-1'), /isn't a FocuzPass export/);
    assert.equal(b.list().length, 0);
});

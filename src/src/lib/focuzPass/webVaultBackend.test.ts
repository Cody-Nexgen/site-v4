import assert from 'node:assert/strict';
import test from 'node:test';
import { FocuzPassVault, createMemoryStorage, type DecryptedVaultItem, type VaultSnapshot, type VaultStatus } from './vaultCore';
import { createMemoryCloud, memoryCloudStore } from './cloud/store';
import { WebVaultBackend } from './webVaultBackend';

const USER = '11111111-aaaa-4aaa-8aaa-111111111111';
const MASTER = 'correct-horse-master-9';

async function setup() {
    const cloud = createMemoryCloud();
    cloud.users.set(USER, { email: 'sam@acme.test', pro: true });
    const store = memoryCloudStore(cloud, () => USER);
    const laptop = new FocuzPassVault(createMemoryStorage());
    await laptop.setup(MASTER);
    const work = await laptop.createVault({ name: 'Work', color: '#4e91da', icon: 'vault' });
    const tag = await laptop.createTag({ name: 'Finance', color: '#e0af68', icon: 'tag' });
    await laptop.upsert({ type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'gh-pass-1', vaultId: work.id, tagIds: [tag.id] });
    const kit = await laptop.prepareCloud(MASTER, { id: USER, email: 'sam@acme.test' });
    await laptop.enableCloud(store);
    const events: string[] = [];
    const web = new WebVaultBackend(store, (event) => events.push(event.type), null);
    const ask = async <T>(message: Record<string, unknown>) => {
        const answer = await web.handle(message as { type: string });
        if (!answer.ok) throw new Error(answer.error);
        return answer.data as T;
    };
    return { cloud, store, laptop, web, ask, events, secretKey: kit.secretKey, work, tag };
}

test('Web vault: locked until the Security Key and master password open it, then it\'s the whole vault', async () => {
    const { web, ask, events, secretKey } = await setup();
    const locked = await ask<VaultStatus>({ type: 'FOCUZPASS_STATUS' });
    assert.deepEqual([locked.configured, locked.unlocked, locked.platform], [true, false, 'web']);
    await assert.rejects(ask({ type: 'FOCUZPASS_SNAPSHOT' }), /locked/);
    await assert.rejects(web.open({ masterPassword: 'wrong-master-1', secretKey }), /don't open this account/);

    await web.open({ masterPassword: MASTER, secretKey });
    assert.deepEqual(events, ['FOCUZPASS_ACCESS_CHANGED']);
    const status = await ask<VaultStatus>({ type: 'FOCUZPASS_STATUS' });
    assert.equal(status.unlocked, true);
    assert.equal(status.idleLockMinutes, 5, 'the web vault locks sooner');
    const snapshot = await ask<VaultSnapshot>({ type: 'FOCUZPASS_SNAPSHOT' });
    assert.deepEqual(snapshot.items.map((i) => i.title), ['GitHub']);
    assert.ok(snapshot.vaults.some((v) => v.name === 'Work'), 'same vaults');
    assert.ok(snapshot.tags.some((t) => t.name === 'Finance'), 'same tags');
    assert.equal((snapshot.items[0] as Extract<DecryptedVaultItem, { type: 'login' }>).password, 'gh-pass-1');
});

test('Web vault: edits sync to the other devices, and theirs come in', async () => {
    const { store, laptop, web, ask, events, secretKey, tag } = await setup();
    await web.open({ masterPassword: MASTER, secretKey });

    const added = await ask<DecryptedVaultItem>({ type: 'FOCUZPASS_UPSERT', item: { type: 'login', title: 'Added on the web', identity: 'sam', password: 'web-pass-1', tagIds: [tag.id] } });
    const github = (await ask<VaultSnapshot>({ type: 'FOCUZPASS_SNAPSHOT' })).items.find((i) => i.title === 'GitHub')!;
    await ask({ type: 'FOCUZPASS_UPSERT', item: { id: github.id, type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'edited-on-web' } });
    await ask({ type: 'FOCUZPASS_ITEM_ACTION', action: { action: 'favorite', id: added.id, value: true } });
    await ask({ type: 'FOCUZPASS_CREATE_TAG', collection: { name: 'Shared', color: '#63b995', icon: 'tag' } });

    // No "Sync now": every change goes up on its own a moment later.
    let arrived = false;
    for (let i = 0; i < 40 && !arrived; i++) {
        await new Promise((r) => setTimeout(r, 150));
        await laptop.syncCloud(store);
        arrived = laptop.snapshot().tags.some((t) => t.name === 'Shared') && laptop.snapshot().items.some((item) => item.title === 'Added on the web');
    }
    assert.ok(arrived, 'the web vault pushed its changes by itself');
    assert.equal((await ask<{ pushed: number }>({ type: 'FOCUZPASS_CLOUD_SYNC' })).pushed, 0, 'nothing left waiting');
    await laptop.syncCloud(store);
    const onLaptop = laptop.snapshot();
    const fromWeb = onLaptop.items.find((i) => i.title === 'Added on the web');
    assert.ok(fromWeb?.favorite, 'the new login, favourited');
    assert.deepEqual(fromWeb?.tagIds, [tag.id], 'with its tag');
    assert.equal((onLaptop.items.find((i) => i.title === 'GitHub') as Extract<DecryptedVaultItem, { type: 'login' }>).password, 'edited-on-web');
    assert.ok(onLaptop.tags.some((t) => t.name === 'Shared'));

    await laptop.upsert({ type: 'login', title: 'Added on the laptop', identity: 'sam', password: 'laptop-pass-1' });
    await laptop.syncCloud(store);
    events.length = 0;
    const pulled = await ask<{ pulled: number }>({ type: 'FOCUZPASS_CLOUD_SYNC' });
    assert.equal(pulled.pulled, 1);
    assert.deepEqual(events, ['FOCUZPASS_VAULT_CHANGED'], 'the page is told to reload');
    assert.ok((await ask<VaultSnapshot>({ type: 'FOCUZPASS_SNAPSHOT' })).items.some((i) => i.title === 'Added on the laptop'));
});

test('Web vault: locking drops everything, and extension-only features say so', async () => {
    const { web, ask, events, secretKey } = await setup();
    await web.open({ masterPassword: MASTER, secretKey });
    await assert.rejects(ask({ type: 'FOCUZPASS_PASSKEY_CREATE', options: {} }), /web vault/);
    await assert.rejects(ask({ type: 'FOCUZPASS_CLOUD_JOIN' }), /web vault/);
    assert.deepEqual(await ask({ type: 'FOCUZPASS_PASSKEY_SETTINGS' }), { enabled: false, unavailable: true });
    assert.match(await ask<string>({ type: 'FOCUZPASS_GENERATE', length: 24 }), /^.{24}$/);

    events.length = 0;
    await ask({ type: 'FOCUZPASS_LOCK' });
    assert.deepEqual(events, ['FOCUZPASS_LOCKED']);
    assert.equal(web.isOpen, false);
    assert.equal((await ask<VaultStatus>({ type: 'FOCUZPASS_STATUS' })).unlocked, false);
    await assert.rejects(ask({ type: 'FOCUZPASS_SNAPSHOT' }), /locked/, 'nothing left to read');
    await assert.rejects(ask({ type: 'FOCUZPASS_CLOUD_KIT', masterPassword: MASTER }), /locked/);
});

test('Web vault: opening it doesn\'t log a new device each time', async () => {
    const { cloud, web, secretKey } = await setup();
    await web.open({ masterPassword: MASTER, secretKey });
    web.lock();
    await web.open({ masterPassword: MASTER, secretKey });
    assert.equal(cloud.events.filter((e) => e.kind === 'device_added').length, 0);
});

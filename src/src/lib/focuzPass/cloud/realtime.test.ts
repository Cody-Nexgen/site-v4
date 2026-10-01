import assert from 'node:assert/strict';
import test from 'node:test';
import { FocuzPassVault, createMemoryStorage } from '../vaultCore';
import { createMemoryCloud, memoryCloudStore } from './store';
import { CloudRealtime, realtimeChannelName, type RealtimeLike } from './realtime';

const USER = '11111111-aaaa-4aaa-8aaa-111111111111';
const MASTER = 'correct-horse-master-9';

/** Supabase broadcast in memory: every client on a channel name hears the others (not itself). */
function bus() {
    const channels = new Map<string, Set<{ fire: () => void }>>();
    const sent: { name: string; payload: unknown }[] = [];
    const client = (): RealtimeLike => ({
        channel(name) {
            const listeners: (() => void)[] = [];
            const member = { fire: () => listeners.forEach((listener) => listener()) };
            const channel = {
                on(_type: 'broadcast', _filter: { event: string }, callback: () => void) {
                    listeners.push(callback);
                    return channel;
                },
                subscribe(callback?: (status: string) => void) {
                    if (!channels.has(name)) channels.set(name, new Set());
                    channels.get(name)!.add(member);
                    queueMicrotask(() => callback?.('SUBSCRIBED'));
                    return channel;
                },
                async send(message: { payload: unknown }) {
                    sent.push({ name, payload: message.payload });
                    for (const other of channels.get(name) ?? []) if (other !== member) other.fire();
                    return 'ok';
                },
                member,
            };
            return channel;
        },
        async removeChannel(channel) {
            for (const members of channels.values()) members.delete((channel as unknown as { member: { fire: () => void } }).member);
            return 'ok';
        },
    });
    return { client, sent, channels };
}

test('The realtime channel: the same for the account\'s devices, different for anyone else', async () => {
    const accountKey = crypto.getRandomValues(new Uint8Array(32));
    const a = await realtimeChannelName(accountKey, USER);
    assert.equal(a, await realtimeChannelName(accountKey, USER));
    assert.match(a, /^fp-[0-9a-f]{32}$/);
    assert.notEqual(a, await realtimeChannelName(crypto.getRandomValues(new Uint8Array(32)), USER));
    assert.notEqual(a, await realtimeChannelName(accountKey, '22222222-bbbb-4bbb-8bbb-222222222222'));
    assert.ok(!a.includes(USER.slice(0, 8)), 'the name says nothing about the account');
});

test('A change on one device reaches the other straight away, and the message carries nothing', async () => {
    const cloud = createMemoryCloud();
    cloud.users.set(USER, { email: 'sam@acme.test', pro: true });
    const store = memoryCloudStore(cloud, () => USER);
    const realtime = bus();

    const a = new FocuzPassVault(createMemoryStorage());
    await a.setup(MASTER);
    const kit = await a.prepareCloud(MASTER, { id: USER, email: 'sam@acme.test' });
    await a.enableCloud(store);
    const b = new FocuzPassVault(createMemoryStorage());
    await b.joinCloud(store, { masterPassword: MASTER, secretKey: kit.secretKey });

    // Each device: listen on the account channel; on "changed", sync.
    let bSyncs = 0;
    let bDone: Promise<unknown> = Promise.resolve();
    const aLive = new CloudRealtime(realtime.client(), () => undefined);
    const bLive = new CloudRealtime(realtime.client(), () => {
        bSyncs++;
        bDone = b.syncCloud(store);
    });
    const name = (await a.cloudRealtimeName())!;
    assert.equal(name, await b.cloudRealtimeName(), 'both devices find the same channel');
    await aLive.connect(name);
    await bLive.connect(name);
    await new Promise((r) => setTimeout(r, 0));
    await bDone;
    const syncsAfterJoin = bSyncs;

    await a.upsert({ type: 'login', title: 'Made on A', identity: 'sam', password: 'a-pass-1' });
    const result = await a.syncCloud(store);
    assert.equal(result.pushed, 1);
    aLive.nudge();
    await bDone;
    assert.equal(bSyncs, syncsAfterJoin + 1, 'B heard it once');
    assert.ok(b.snapshot().items.some((item) => item.title === 'Made on A'), 'and has the new login without waiting for a poll');
    assert.deepEqual(realtime.sent.map((m) => m.payload), [{}], 'nothing in the message');

    await bLive.disconnect();
    aLive.nudge();
    assert.equal(bSyncs, syncsAfterJoin + 1, 'a disconnected device hears nothing');
    b.lock();
    assert.equal(await b.cloudRealtimeName(), null, 'a locked vault has no channel');
});

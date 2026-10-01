/**
 * Moving a vault between two devices. The devices meet on a Supabase Realtime channel named
 * after a hash of the code, exchange signed WebRTC offers, and the package goes straight from
 * one browser to the other over a data channel (on the same network that's a LAN link).
 * If no direct route opens (strict firewalls; there's no TURN server), the same bytes go
 * through the Realtime channel instead. Either way the relay only sees ciphertext twice over:
 * the vault is encrypted with its master password, and wrapped again with a key from the code.
 */

import { supabase } from '../../supabase';
import type { VaultExportPackage } from '../types';
import {
    CODE_TTL_MS,
    deriveTransferKeys,
    openPayload,
    sealPayload,
    sha256Hex,
    signMessage,
    verifyMessage,
    type TransferKeys,
} from './code';

export type TransferRoute = 'direct' | 'relay';
export type TransferStatus =
    | { phase: 'waiting' }
    | { phase: 'connecting' }
    | { phase: 'sending' | 'receiving'; route: TransferRoute; progress: number }
    | { phase: 'done'; route: TransferRoute }
    | { phase: 'failed'; error: string };

const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const CHUNK = 16 * 1024;
const RELAY_CHUNK = 48 * 1024;
const DIRECT_TIMEOUT_MS = 10_000;
const FIND_TIMEOUT_MS = 45_000;

type Role = 'sender' | 'receiver';

/**
 * Supabase hands back the same channel object for the same topic, so a transfer that's stopped
 * and started again with the same code (Connect pressed twice, React re-running an effect) would
 * share it with the old one, and the old one leaving would take the channel down. Each topic's
 * channel is shared and counted instead, and a new one waits for the old one to finish leaving.
 */
type SharedChannel = {
    channel: ReturnType<typeof supabase.channel>;
    ready: Promise<void>;
    listeners: Set<(payload: unknown) => void>;
    users: number;
};
const channels = new Map<string, SharedChannel>();
const leaving = new Map<string, Promise<void>>();

function joinTopic(topic: string): SharedChannel {
    const existing = channels.get(topic);
    if (existing) return existing;
    const channel = supabase.channel(topic, { config: { broadcast: { self: false } } });
    const listeners = new Set<(payload: unknown) => void>();
    channel.on('broadcast', { event: 'm' }, ({ payload }) => listeners.forEach((listener) => listener(payload)));
    const ready = new Promise<void>((resolve, reject) => {
        channel.subscribe((state) => {
            if (state === 'SUBSCRIBED') resolve();
            else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') reject(new Error('Couldn\'t reach FocuzNow to connect the devices. Check your internet connection.'));
        });
    });
    const shared = { channel, ready, listeners, users: 0 };
    channels.set(topic, shared);
    return shared;
}

async function openChannel(keys: TransferKeys, role: Role, onMessage: (kind: string, body: unknown) => void) {
    const other: Role = role === 'sender' ? 'receiver' : 'sender';
    const topic = keys.channel;
    await Promise.race([leaving.get(topic), sleep(4000)]);
    const shared = joinTopic(topic);
    shared.users++;
    const listener = (payload: unknown) => {
        void verifyMessage(keys, payload, other).then((ok) => {
            // Anything not signed with this code (or replayed from the wrong side) is dropped.
            if (ok) onMessage((payload as { kind: string }).kind, (payload as { body: unknown }).body);
        });
    };
    shared.listeners.add(listener);
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        shared.listeners.delete(listener);
        if (--shared.users > 0) return;
        channels.delete(topic);
        const done: Promise<void> = Promise.resolve()
            .then(() => supabase.removeChannel(shared.channel))
            .then(
                () => undefined,
                () => undefined,
            )
            .finally(() => {
                if (leaving.get(topic) === done) leaving.delete(topic);
            });
        leaving.set(topic, done);
    };
    try {
        await Promise.race([
            shared.ready,
            sleep(20_000).then(() => {
                throw new Error('Couldn\'t reach FocuzNow to connect the devices. Check your internet connection.');
            }),
        ]);
    } catch (error) {
        close();
        throw error;
    }
    return {
        post: async (kind: string, body: unknown) => {
            await shared.channel.send({ type: 'broadcast', event: 'm', payload: await signMessage(keys, { kind, from: role, body }) });
        },
        close,
    };
}

/** Resolves once ICE gathering finishes (or after a short wait): offers go out complete, no trickle. */
function gathered(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => {
            pc.removeEventListener('icegatheringstatechange', check);
            clearTimeout(timer);
            resolve();
        };
        const check = () => pc.iceGatheringState === 'complete' && done();
        const timer = setTimeout(done, 1200);
        pc.addEventListener('icegatheringstatechange', check);
    });
}

function toBase64(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}

function fromBase64(value: string): Uint8Array {
    const s = atob(value);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The device with the vault. Shows the code and waits; the first device that proves it has the
 * code gets the package. Returns a cancel function.
 */
export function sendVault(options: {
    code: string;
    getPackage: () => Promise<VaultExportPackage>;
    onStatus: (status: TransferStatus) => void;
}): () => void {
    const { code, getPackage, onStatus } = options;
    let stopped = false;
    let pc: RTCPeerConnection | null = null;
    let channel: Awaited<ReturnType<typeof openChannel>> | null = null;
    let route: TransferRoute | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const stop = () => {
        stopped = true;
        timers.forEach(clearTimeout);
        pc?.close();
        channel?.close();
    };
    const fail = (error: string) => {
        if (stopped) return;
        onStatus({ phase: 'failed', error });
        stop();
    };

    const sendDirect = async (dc: RTCDataChannel, sealed: Uint8Array, digest: string) => {
        dc.send(JSON.stringify({ size: sealed.length, digest }));
        dc.bufferedAmountLowThreshold = 256 * 1024;
        for (let i = 0; i < sealed.length && !stopped; i += CHUNK) {
            if (dc.bufferedAmount > 1024 * 1024) {
                await new Promise<void>((resolve) => dc.addEventListener('bufferedamountlow', () => resolve(), { once: true }));
            }
            dc.send(sealed.slice(i, i + CHUNK));
            onStatus({ phase: 'sending', route: 'direct', progress: Math.min(1, (i + CHUNK) / sealed.length) });
        }
    };

    const sendRelay = async (sealed: Uint8Array, digest: string) => {
        const parts = Math.ceil(sealed.length / RELAY_CHUNK);
        await channel!.post('relay-start', { size: sealed.length, digest, parts });
        for (let i = 0; i < parts && !stopped; i++) {
            await channel!.post('relay-part', { i, data: toBase64(sealed.subarray(i * RELAY_CHUNK, (i + 1) * RELAY_CHUNK)) });
            onStatus({ phase: 'sending', route: 'relay', progress: (i + 1) / parts });
            await sleep(80); // stay well under the relay's message rate
        }
    };

    const start = async () => {
        onStatus({ phase: 'connecting' });
        const sealed = await sealPayload(await deriveTransferKeys(code), JSON.stringify(await getPackage()));
        const digest = await sha256Hex(sealed);
        pc = new RTCPeerConnection(ICE);
        const dc = pc.createDataChannel('vault', { ordered: true });
        dc.binaryType = 'arraybuffer';
        dc.onopen = () => {
            if (route || stopped) return;
            route = 'direct';
            void sendDirect(dc, sealed, digest).catch(() => fail('The connection dropped while sending. Try again.'));
        };
        await pc.setLocalDescription(await pc.createOffer());
        await gathered(pc);
        await channel!.post('offer', pc.localDescription?.toJSON());
        timers.push(
            setTimeout(() => {
                if (route || stopped) return;
                route = 'relay';
                pc?.close();
                void sendRelay(sealed, digest).catch(() => fail('Sending through the relay failed. Try again, or use a backup file.'));
            }, DIRECT_TIMEOUT_MS),
        );
    };

    void (async () => {
        const keys = await deriveTransferKeys(code);
        let started = false;
        channel = await openChannel(keys, 'sender', (kind, body) => {
            if (stopped) return;
            if (kind === 'hello' && !started) {
                started = true;
                void start().catch((error) => fail(error instanceof Error ? error.message : 'Couldn\'t start the transfer.'));
            } else if (kind === 'answer' && pc && !route) {
                void pc.setRemoteDescription(body as RTCSessionDescriptionInit).catch(() => undefined);
            } else if (kind === 'received') {
                onStatus({ phase: 'done', route: route ?? 'direct' });
                stop();
            } else if (kind === 'error') {
                fail(String((body as { message?: string })?.message || 'The other device couldn\'t open the transfer.'));
            }
        });
        if (stopped) return channel.close();
        onStatus({ phase: 'waiting' });
        timers.push(setTimeout(() => fail('This code expired. Make a new one.'), CODE_TTL_MS));
    })().catch((error) => fail(error instanceof Error ? error.message : 'Couldn\'t start the transfer.'));

    return stop;
}

/**
 * The device that's receiving: joins with the code and hands back the package (still encrypted
 * with the other vault's master password). Returns a cancel function.
 */
export function receiveVault(options: {
    code: string;
    onStatus: (status: TransferStatus) => void;
    onPackage: (pkg: VaultExportPackage) => void;
}): () => void {
    const { code, onStatus, onPackage } = options;
    let stopped = false;
    let pc: RTCPeerConnection | null = null;
    let channel: Awaited<ReturnType<typeof openChannel>> | null = null;
    let keys: TransferKeys | null = null;
    let finished = false;
    const timers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];
    let relay: { size: number; digest: string; parts: number; chunks: Uint8Array[]; count: number } | null = null;

    const stop = () => {
        stopped = true;
        timers.forEach((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
        timers.forEach((t) => clearInterval(t as ReturnType<typeof setInterval>));
        pc?.close();
        channel?.close();
    };
    const fail = (error: string) => {
        if (stopped) return;
        onStatus({ phase: 'failed', error });
        stop();
    };

    const finish = async (sealed: Uint8Array, digest: string, route: TransferRoute) => {
        if (finished) return;
        finished = true;
        if ((await sha256Hex(sealed)) !== digest) return fail('The transfer arrived damaged. Try again.');
        let pkg: VaultExportPackage;
        try {
            pkg = JSON.parse(await openPayload(keys!, sealed)) as VaultExportPackage;
        } catch {
            return fail('The transfer couldn\'t be opened with this code.');
        }
        await channel?.post('received', {}).catch(() => undefined);
        onStatus({ phase: 'done', route });
        stop();
        onPackage(pkg);
    };

    const receiveDirect = (dc: RTCDataChannel) => {
        dc.binaryType = 'arraybuffer';
        let header: { size: number; digest: string } | null = null;
        const chunks: Uint8Array[] = [];
        let received = 0;
        dc.onmessage = (event) => {
            if (typeof event.data === 'string') {
                header = JSON.parse(event.data);
                return;
            }
            if (!header) return;
            const chunk = new Uint8Array(event.data as ArrayBuffer);
            chunks.push(chunk);
            received += chunk.length;
            onStatus({ phase: 'receiving', route: 'direct', progress: Math.min(1, received / header.size) });
            if (received >= header.size) {
                const all = new Uint8Array(received);
                let offset = 0;
                for (const c of chunks) {
                    all.set(c, offset);
                    offset += c.length;
                }
                void finish(all.subarray(0, header.size), header.digest, 'direct');
            }
        };
    };

    const onMessage = async (kind: string, body: unknown) => {
        if (stopped) return;
        if (kind === 'offer' && !pc) {
            timers.forEach((t) => clearInterval(t as ReturnType<typeof setInterval>));
            pc = new RTCPeerConnection(ICE);
            pc.ondatachannel = (event) => receiveDirect(event.channel);
            await pc.setRemoteDescription(body as RTCSessionDescriptionInit);
            await pc.setLocalDescription(await pc.createAnswer());
            await gathered(pc);
            await channel!.post('answer', pc.localDescription?.toJSON());
        } else if (kind === 'relay-start') {
            const b = body as { size: number; digest: string; parts: number };
            relay = { ...b, chunks: new Array(b.parts), count: 0 };
            pc?.close();
        } else if (kind === 'relay-part' && relay) {
            const { i, data } = body as { i: number; data: string };
            if (!relay.chunks[i]) {
                relay.chunks[i] = fromBase64(data);
                relay.count++;
            }
            onStatus({ phase: 'receiving', route: 'relay', progress: relay.count / relay.parts });
            if (relay.count === relay.parts) {
                const all = new Uint8Array(relay.chunks.reduce((n, c) => n + c.length, 0));
                let offset = 0;
                for (const c of relay.chunks) {
                    all.set(c, offset);
                    offset += c.length;
                }
                void finish(all.subarray(0, relay.size), relay.digest, 'relay');
            }
        }
    };

    void (async () => {
        keys = await deriveTransferKeys(code);
        channel = await openChannel(keys, 'receiver', (kind, body) => void onMessage(kind, body).catch(() => fail('Couldn\'t connect to the other device. Try again.')));
        if (stopped) return channel.close();
        onStatus({ phase: 'connecting' });
        // Keep saying hello until the other device answers; it may still be opening the code.
        void channel.post('hello', {});
        timers.push(setInterval(() => void channel?.post('hello', {}), 2000));
        timers.push(
            setTimeout(() => {
                if (!pc && !relay) fail('Couldn\'t find the other device. Check the code, and keep FocuzPass open on that device.');
            }, FIND_TIMEOUT_MS),
        );
    })().catch((error) => fail(error instanceof Error ? error.message : 'Couldn\'t connect.'));

    return stop;
}

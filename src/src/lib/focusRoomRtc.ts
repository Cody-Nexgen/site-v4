import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { AttachmentRecord } from './attachmentApi';

/**
 * Focus Room WebSocket signaling protocol
 * ---------------------------------------
 * Prefer WS when a URL is configured (storage/env). Media stays WebRTC; only
 * offer/answer/ICE (+ room control/chat) ride the socket.
 *
 * Resolve URL from (first match wins):
 *   1. chrome.storage.local / localStorage key `focuzFocusRoomWsUrl`
 *   2. import.meta.env.VITE_FOCUS_ROOM_WS_URL
 *   3. process.env.VITE_FOCUS_ROOM_WS_URL | process.env.FOCUS_ROOM_WS_URL
 * If none, fall back to Supabase Realtime broadcast on `focus-room:{roomId}`.
 *
 * Messages are JSON objects:
 *   { type, roomId, from, to?, ...payload }
 *
 * Client → server (and fan-out to peers):
 *   join         { name?, avatarUrl? }          — also sent as type on connect
 *   leave        {}                             — peer leaving
 *   offer        { to, sdp, name?, avatarUrl? }
 *   answer       { to, sdp }
 *   ice          { to, candidate }
 *   chat         { id, name, text, at, attachment? }
 *   chat-delete  { attachmentId }
 *   kick         { to }                         — host only
 *   mute         { to }                         — host only
 *   room-lock    { to: '*', locked }
 *   end-session  { to: '*' }
 *
 * Server → client: same shapes; ignore messages from self; route directed
 * messages when `to` is set (or `to === '*'` for room-wide).
 */

export const FOCUS_ROOM_WS_URL_KEY = 'focuzFocusRoomWsUrl';

/** Production WSS (Caddy/TLS on the VPS). HTTPS sites require wss:// — plain ws:// is blocked. */
export const DEFAULT_FOCUS_ROOM_WS_URL = 'wss://signal.focuznow.com';
/** Direct IP fallback for local/extension testing when DNS/TLS is down. */
export const FALLBACK_FOCUS_ROOM_WS_URL = 'ws://170.205.37.149:8080';

/** Free tier meeting cap (minutes). Pro can go higher. */
export const FREE_FOCUS_ROOM_MAX_MIN = 24;
export const PRO_FOCUS_ROOM_MAX_MIN = 180;

export type RtcPeer = {
    peerId: string;
    displayName: string;
    avatarUrl?: string | null;
    stream: MediaStream | null;
    isLocal?: boolean;
    speaking?: boolean;
    mutedByHost?: boolean;
};

export type ChatMessage = {
    id: string;
    from: string;
    name: string;
    text: string;
    at: number;
    attachment?: AttachmentRecord;
};

export type MediaDeviceLists = {
    audioInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
};

type SignalPayload = {
    from: string;
    to: string;
    type: 'offer' | 'answer' | 'ice' | 'chat' | 'kick' | 'mute' | 'room-lock' | 'end-session';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    text?: string;
    name?: string;
    avatarUrl?: string | null;
    locked?: boolean;
    attachmentId?: string;
};

type JoinPrefs = {
    micId?: string;
    speakerId?: string;
    cameraId?: string;
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
    autoGainControl?: boolean;
};

type WsEnvelope = {
    type: string;
    roomId: string;
    from: string;
    to?: string;
    peerId?: string;
    name?: string;
    avatarUrl?: string | null;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    locked?: boolean;
    attachmentId?: string;
    id?: string;
    text?: string;
    at?: number;
    attachment?: AttachmentRecord;
    [key: string]: unknown;
};

type SignalingHandlers = {
    onSignal: (payload: SignalPayload) => void;
    onJoin: (payload: {
        peerId?: string;
        name?: string;
        avatarUrl?: string | null;
        accountUserId?: string | null;
    }) => void;
    onLeave: (payload: { peerId?: string }) => void;
    onChat: (payload: ChatMessage) => void;
    onChatDelete: (payload: { attachmentId?: string }) => void;
    onKick: (payload: { to?: string }) => void;
};

type SignalingBus = {
    send: (event: 'signal' | 'join' | 'leave' | 'chat' | 'chat-delete' | 'kick', payload: Record<string, unknown>) => void;
    close: () => void;
};

function randomPeerId() {
    return `peer_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Shown for the brief window before a peer's real name/avatar has arrived via the join or
 * signal broadcast (both of which always carry `name`/`avatarUrl`). Never surface the raw
 * internal peer id (e.g. "peer_x223e89") in the UI.
 */
const PENDING_PEER_LABEL = 'Guest';

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Public TURN fallback so peers behind symmetric NAT can still exchange media.
    {
        urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

async function resolveFocusRoomWsUrl(): Promise<string> {
    const candidates: string[] = [];

    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const stored = await chrome.storage.local.get(FOCUS_ROOM_WS_URL_KEY);
            const value = stored[FOCUS_ROOM_WS_URL_KEY];
            if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
        }
    } catch {
        /* ignore */
    }
    try {
        if (typeof localStorage !== 'undefined') {
            const value = localStorage.getItem(FOCUS_ROOM_WS_URL_KEY);
            if (value?.trim()) candidates.push(value.trim());
        }
    } catch {
        /* ignore */
    }
    try {
        const envBag = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
        const vite =
            envBag?.VITE_FOCUS_ROOM_WS_URL ||
            envBag?.NEXT_PUBLIC_FOCUS_ROOM_WS_URL;
        if (typeof vite === 'string' && vite.trim()) candidates.push(vite.trim());
    } catch {
        /* ignore */
    }
    try {
        const env = (typeof process !== 'undefined' ? process.env : undefined) as
            | Record<string, string | undefined>
            | undefined;
        const value =
            env?.NEXT_PUBLIC_FOCUS_ROOM_WS_URL ||
            env?.VITE_FOCUS_ROOM_WS_URL ||
            env?.FOCUS_ROOM_WS_URL;
        if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
    } catch {
        /* ignore */
    }

    return candidates[0] || DEFAULT_FOCUS_ROOM_WS_URL;
}

function signalingUrlAlternates(primary: string): string[] {
    const urls: string[] = [];
    const push = (u: string) => {
        if (u && !urls.includes(u)) urls.push(u);
    };
    push(primary);
    if (primary.startsWith('wss://')) push(`ws://${primary.slice('wss://'.length)}`);
    else if (primary.startsWith('ws://')) push(`wss://${primary.slice('ws://'.length)}`);
    push(DEFAULT_FOCUS_ROOM_WS_URL);
    push(FALLBACK_FOCUS_ROOM_WS_URL);
    push(`wss://${FALLBACK_FOCUS_ROOM_WS_URL.slice('ws://'.length)}`);

    const secure =
        typeof window !== 'undefined' && window.location?.protocol === 'https:';
    // On HTTPS, only attempt wss:// (browsers block mixed-content ws://).
    const filtered = secure ? urls.filter((u) => u.startsWith('wss://')) : urls;
    return filtered.length ? filtered : [DEFAULT_FOCUS_ROOM_WS_URL];
}

function connectWsSignaling(
    url: string,
    roomId: string,
    peerId: string,
    displayName: string,
    avatarUrl: string | null | undefined,
    handlers: SignalingHandlers,
    accountUserId?: string | null,
): Promise<SignalingBus> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const ws = new WebSocket(url);
        const timeoutId = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            try {
                ws.close();
            } catch {
                /* ignore */
            }
            reject(new Error(`Focus room WebSocket timed out (${url})`));
        }, 8000);

        const sendEnvelope = (type: string, payload: Record<string, unknown> = {}) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const { to, ...rest } = payload;
            ws.send(
                JSON.stringify({
                    type,
                    roomId,
                    from: peerId,
                    ...(typeof to === 'string' ? { to } : {}),
                    ...rest,
                }),
            );
        };

        const bus: SignalingBus = {
            send: (event, payload) => {
                if (event === 'signal') {
                    const type = String(payload.type ?? '');
                    sendEnvelope(type, payload);
                    return;
                }
                if (event === 'join') {
                    sendEnvelope('join', {
                        peerId,
                        name: (payload.name as string) ?? displayName,
                        avatarUrl: (payload.avatarUrl as string | null | undefined) ?? avatarUrl,
                        accountUserId: (payload.accountUserId as string | null | undefined) ?? accountUserId,
                    });
                    return;
                }
                if (event === 'leave') {
                    sendEnvelope('leave', { peerId: (payload.peerId as string) ?? peerId });
                    return;
                }
                if (event === 'kick') {
                    sendEnvelope('kick', payload);
                    return;
                }
                if (event === 'chat-delete') {
                    sendEnvelope('chat-delete', payload);
                    return;
                }
                sendEnvelope(event, payload);
            },
            close: () => {
                try {
                    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                        sendEnvelope('leave', { peerId });
                        ws.close();
                    }
                } catch {
                    /* ignore */
                }
            },
        };

        ws.onopen = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            bus.send('join', { peerId, name: displayName, avatarUrl, accountUserId });
            resolve(bus);
        };

        ws.onerror = () => {
            if (!settled) {
                settled = true;
                window.clearTimeout(timeoutId);
                reject(new Error('Focus room WebSocket failed to connect'));
            }
        };

        ws.onmessage = (event) => {
            let msg: WsEnvelope;
            try {
                msg = JSON.parse(String(event.data)) as WsEnvelope;
            } catch {
                return;
            }
            if (!msg?.type || msg.from === peerId) return;
            if (msg.roomId && msg.roomId !== roomId) return;

            switch (msg.type) {
                case 'join':
                    handlers.onJoin({
                        peerId: msg.peerId || msg.from,
                        name: msg.name,
                        avatarUrl: msg.avatarUrl,
                        accountUserId: (msg as WsEnvelope & { accountUserId?: string }).accountUserId,
                    });
                    break;
                case 'leave':
                    handlers.onLeave({ peerId: msg.peerId || msg.from });
                    break;
                case 'offer':
                case 'answer':
                case 'ice':
                case 'mute':
                case 'room-lock':
                case 'end-session':
                    handlers.onSignal({
                        from: msg.from,
                        to: msg.to ?? '*',
                        type: msg.type,
                        sdp: msg.sdp,
                        candidate: msg.candidate,
                        name: msg.name,
                        avatarUrl: msg.avatarUrl,
                        locked: msg.locked,
                    });
                    break;
                case 'chat':
                    handlers.onChat({
                        id: msg.id || `${Date.now()}`,
                        from: msg.from,
                        name: msg.name || PENDING_PEER_LABEL,
                        text: msg.text || '',
                        at: msg.at || Date.now(),
                        attachment: msg.attachment,
                    });
                    break;
                case 'chat-delete':
                    handlers.onChatDelete({ attachmentId: msg.attachmentId });
                    break;
                case 'kick':
                    handlers.onKick({ to: msg.to });
                    break;
                default:
                    break;
            }
        };
    });
}

function connectRealtimeSignaling(
    supabase: SupabaseClient,
    roomId: string,
    peerId: string,
    displayName: string,
    avatarUrl: string | null | undefined,
    handlers: SignalingHandlers,
    accountUserId?: string | null,
): Promise<{ bus: SignalingBus; channel: RealtimeChannel }> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const channel = supabase.channel(`focus-room:${roomId}`, {
            config: { broadcast: { self: false } },
        });

        const fail = (reason: string) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            void supabase.removeChannel(channel);
            reject(new Error(reason));
        };

        const timeoutId = window.setTimeout(() => {
            fail('Focus room Realtime signaling timed out');
        }, 6000);

        const bus: SignalingBus = {
            send: (event, payload) => {
                void channel.send({ type: 'broadcast', event, payload });
            },
            close: () => {
                void channel.send({
                    type: 'broadcast',
                    event: 'leave',
                    payload: { peerId },
                });
                void supabase.removeChannel(channel);
            },
        };

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                handlers.onSignal(payload as SignalPayload);
            })
            .on('broadcast', { event: 'join' }, ({ payload }) => {
                const p = payload as {
                    peerId?: string;
                    from?: string;
                    name?: string;
                    avatarUrl?: string | null;
                    accountUserId?: string | null;
                };
                handlers.onJoin({
                    peerId: p.peerId || p.from,
                    name: p.name,
                    avatarUrl: p.avatarUrl,
                    accountUserId: p.accountUserId,
                });
            })
            .on('broadcast', { event: 'leave' }, ({ payload }) => {
                handlers.onLeave(payload as { peerId?: string });
            })
            .on('broadcast', { event: 'chat' }, ({ payload }) => {
                handlers.onChat(payload as ChatMessage);
            })
            .on('broadcast', { event: 'chat-delete' }, ({ payload }) => {
                handlers.onChatDelete(payload as { attachmentId?: string });
            })
            .on('broadcast', { event: 'kick' }, ({ payload }) => {
                handlers.onKick(payload as { to?: string });
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timeoutId);
                    bus.send('join', { peerId, name: displayName, avatarUrl, accountUserId });
                    resolve({ bus, channel });
                    return;
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    fail(`Focus room Realtime signaling ${status}`);
                }
            });
    });
}

export function useFocusRoomRtc(
    supabase: SupabaseClient,
    roomId: string | null,
    displayName: string,
    enabled: boolean,
    isHost: boolean,
    joinPrefs?: JoinPrefs,
    avatarUrl?: string | null,
    accountUserId?: string | null,
) {
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<RtcPeer[]>([]);
    const [rtcError, setRtcError] = useState('');
    const [chat, setChat] = useState<ChatMessage[]>([]);
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
    const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicId, setSelectedMicId] = useState(joinPrefs?.micId ?? '');
    const [selectedSpeakerId, setSelectedSpeakerId] = useState(joinPrefs?.speakerId ?? '');
    const [selectedCameraId, setSelectedCameraId] = useState(joinPrefs?.cameraId ?? '');
    const [roomLocked, setRoomLocked] = useState(false);
    const [previewReady, setPreviewReady] = useState(false);
    const [permissionState, setPermissionState] = useState<'pending' | 'granted' | 'denied'>('pending');

    // Stable per-account peer id so refreshes/reconnects don't look like a new person.
    const fallbackPeerId = useRef(randomPeerId()).current;
    const peerId = accountUserId ? `u_${accountUserId}` : fallbackPeerId;
    const busRef = useRef<SignalingBus | null>(null);
    const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const dcMapRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const makingOfferRef = useRef<Set<string>>(new Set());
    const politeRef = useRef<Map<string, boolean>>(new Map());
    const camOnRef = useRef(camOn);
    camOnRef.current = camOn;
    const startLocalMediaRef = useRef<(opts?: {
        micId?: string;
        cameraId?: string;
        withVideo?: boolean;
        previewOnly?: boolean;
    }) => Promise<void>>(async () => {});
    const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const disconnectTimersRef = useRef<Map<string, number>>(new Map());
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number>(0);
    const prefsRef = useRef(joinPrefs);
    const roomLockedRef = useRef(false);
    const peerIdRef = useRef(peerId);
    const displayNameRef = useRef(displayName);
    const avatarUrlRef = useRef(avatarUrl);
    const accountUserIdRef = useRef(accountUserId);
    const isHostRef = useRef(isHost);
    const handleSignalRef = useRef<(payload: SignalPayload) => void>(() => {});
    const createPeerConnectionRef = useRef<(remoteId: string, initiator: boolean) => RTCPeerConnection>(
        () => new RTCPeerConnection(),
    );
    const cleanupPeerRef = useRef<(remoteId: string) => void>(() => {});

    useEffect(() => {
        prefsRef.current = joinPrefs;
    }, [joinPrefs]);

    useEffect(() => {
        roomLockedRef.current = roomLocked;
    }, [roomLocked]);

    useEffect(() => {
        peerIdRef.current = peerId;
        displayNameRef.current = displayName;
        avatarUrlRef.current = avatarUrl;
        accountUserIdRef.current = accountUserId;
        isHostRef.current = isHost;
    }, [peerId, displayName, avatarUrl, accountUserId, isHost]);

    const refreshDevices = useCallback(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
        setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
    }, []);

    const cleanupPeer = useCallback((remoteId: string) => {
        const timer = disconnectTimersRef.current.get(remoteId);
        if (timer) {
            window.clearTimeout(timer);
            disconnectTimersRef.current.delete(remoteId);
        }
        pendingIceRef.current.delete(remoteId);
        const pc = pcMapRef.current.get(remoteId);
        if (pc) {
            pc.close();
            pcMapRef.current.delete(remoteId);
        }
        dcMapRef.current.delete(remoteId);
        makingOfferRef.current.delete(remoteId);
        politeRef.current.delete(remoteId);
        setPeers((prev) => prev.filter((p) => p.peerId !== remoteId));
    }, []);

    const flushPendingIce = useCallback(async (remoteId: string, pc: RTCPeerConnection) => {
        const queued = pendingIceRef.current.get(remoteId) ?? [];
        pendingIceRef.current.delete(remoteId);
        for (const candidate of queued) {
            try {
                await pc.addIceCandidate(candidate);
            } catch {
                /* late/duplicate candidates */
            }
        }
    }, []);

    const sendChat = useCallback((text: string, attachment?: AttachmentRecord) => {
        const trimmed = text.trim();
        if (!trimmed && !attachment) return;
        const msg: ChatMessage = {
            id: crypto.randomUUID(),
            from: peerId,
            name: displayName,
            text: trimmed,
            at: Date.now(),
            ...(attachment ? { attachment } : {}),
        };
        setChat((c) => [...c, msg]);
        busRef.current?.send('chat', msg as unknown as Record<string, unknown>);
    }, [displayName, peerId]);

    const removeChatAttachment = useCallback((attachmentId: string) => {
        setChat((current) => current.filter((message) => message.attachment?.id !== attachmentId));
        busRef.current?.send('chat-delete', { attachmentId });
    }, []);

    const renegotiate = useCallback(async (remoteId: string) => {
        const pc = pcMapRef.current.get(remoteId);
        const bus = busRef.current;
        if (!pc || !bus || makingOfferRef.current.has(remoteId)) return;
        try {
            makingOfferRef.current.add(remoteId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            bus.send('signal', {
                from: peerId,
                to: remoteId,
                type: 'offer',
                sdp: offer,
                name: displayName,
                avatarUrl,
            });
        } catch (err) {
            console.warn('[FocusRoomRtc] renegotiate', err);
        } finally {
            makingOfferRef.current.delete(remoteId);
        }
    }, [displayName, avatarUrl, peerId]);

    const kickPeer = useCallback(
        (remoteId: string) => {
            if (!isHost) return;
            busRef.current?.send('kick', { from: peerId, to: remoteId });
            cleanupPeer(remoteId);
        },
        [isHost, cleanupPeer, peerId],
    );

    const mutePeer = useCallback(
        (remoteId: string) => {
            if (!isHost) return;
            busRef.current?.send('signal', {
                from: peerId,
                to: remoteId,
                type: 'mute',
            });
            setPeers((prev) =>
                prev.map((p) => (p.peerId === remoteId ? { ...p, mutedByHost: true } : p)),
            );
        },
        [isHost, peerId],
    );

    const setRoomLock = useCallback(
        (locked: boolean) => {
            if (!isHost) return;
            setRoomLocked(locked);
            busRef.current?.send('signal', {
                from: peerId,
                to: '*',
                type: 'room-lock',
                locked,
            });
        },
        [isHost, peerId],
    );

    const endSession = useCallback(() => {
        if (!isHost) return;
        busRef.current?.send('signal', {
            from: peerId,
            to: '*',
            type: 'end-session',
        });
    }, [isHost, peerId]);

    const wireDataChannel = useCallback((dc: RTCDataChannel, remoteId: string) => {
        dcMapRef.current.set(remoteId, dc);
        dc.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data as string) as ChatMessage & { type?: string };
                if (data.type === 'chat' && (data.text || data.attachment)) {
                    setChat((c) => [
                        ...c,
                        {
                            id: data.id || `${Date.now()}`,
                            from: remoteId,
                            name: data.name || PENDING_PEER_LABEL,
                            text: data.text,
                            at: data.at || Date.now(),
                            attachment: data.attachment,
                        },
                    ]);
                }
            } catch {
                /* ignore */
            }
        };
    }, []);

    const createPeerConnection = useCallback(
        (remoteId: string, initiator: boolean) => {
            const existing = pcMapRef.current.get(remoteId);
            if (existing) return existing;

            politeRef.current.set(remoteId, !initiator);

            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const stream = localStreamRef.current;
            if (stream) {
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));
            }

            if (initiator) {
                const dc = pc.createDataChannel('focuz-chat');
                wireDataChannel(dc, remoteId);
            } else {
                pc.ondatachannel = (ev) => wireDataChannel(ev.channel, remoteId);
            }

            pc.onicecandidate = (ev) => {
                if (!ev.candidate) return;
                busRef.current?.send('signal', {
                    from: peerId,
                    to: remoteId,
                    type: 'ice',
                    candidate: ev.candidate.toJSON(),
                });
            };

            pc.ontrack = (ev) => {
                setPeers((prev) => {
                    const hit = prev.find((p) => p.peerId === remoteId);
                    const stream = hit?.stream ?? new MediaStream();
                    if (!stream.getTracks().some((t) => t.id === ev.track.id)) {
                        stream.addTrack(ev.track);
                    }
                    // Also pull any tracks from the event's stream(s)
                    for (const inbound of ev.streams) {
                        for (const track of inbound.getTracks()) {
                            if (!stream.getTracks().some((t) => t.id === track.id)) {
                                stream.addTrack(track);
                            }
                        }
                    }
                    ev.track.onunmute = () => {
                        setPeers((current) =>
                            current.map((p) =>
                                p.peerId === remoteId && p.stream
                                    ? { ...p, stream: new MediaStream(p.stream.getTracks()) }
                                    : p,
                            ),
                        );
                    };
                    if (hit) {
                        return prev.map((p) =>
                            p.peerId === remoteId ? { ...p, stream: new MediaStream(stream.getTracks()) } : p,
                        );
                    }
                    return [
                        ...prev,
                        {
                            peerId: remoteId,
                            displayName: PENDING_PEER_LABEL,
                            stream: new MediaStream(stream.getTracks()),
                        },
                    ];
                });
            };

            // Only the offerer renegotiates; the answerer waits for the next remote offer.
            pc.onnegotiationneeded = () => {
                if (!initiator || makingOfferRef.current.has(remoteId)) return;
                void renegotiate(remoteId);
            };

            pc.onconnectionstatechange = () => {
                const state = pc.connectionState;
                if (state === 'connected' || state === 'connecting') {
                    const timer = disconnectTimersRef.current.get(remoteId);
                    if (timer) {
                        window.clearTimeout(timer);
                        disconnectTimersRef.current.delete(remoteId);
                    }
                    return;
                }
                if (state === 'failed') {
                    try {
                        pc.restartIce();
                    } catch {
                        /* ignore */
                    }
                    const existing = disconnectTimersRef.current.get(remoteId);
                    if (existing) window.clearTimeout(existing);
                    disconnectTimersRef.current.set(
                        remoteId,
                        window.setTimeout(() => {
                            if (
                                pc.connectionState === 'failed' ||
                                pc.connectionState === 'closed'
                            ) {
                                cleanupPeer(remoteId);
                            }
                        }, 10000),
                    );
                    return;
                }
                if (state === 'disconnected') {
                    const existing = disconnectTimersRef.current.get(remoteId);
                    if (existing) window.clearTimeout(existing);
                    disconnectTimersRef.current.set(
                        remoteId,
                        window.setTimeout(() => {
                            if (
                                pc.connectionState === 'disconnected' ||
                                pc.connectionState === 'failed'
                            ) {
                                cleanupPeer(remoteId);
                            }
                        }, 8000),
                    );
                    return;
                }
                if (state === 'closed') {
                    cleanupPeer(remoteId);
                }
            };

            pcMapRef.current.set(remoteId, pc);
            return pc;
        },
        [cleanupPeer, wireDataChannel, renegotiate, peerId],
    );

    const handleSignal = useCallback(
        async (payload: SignalPayload) => {
            if (!payload) return;

            if (payload.type === 'room-lock' && payload.to === '*') {
                setRoomLocked(!!payload.locked);
                return;
            }

            if (payload.type === 'end-session' && payload.to === '*') {
                setRtcError('Session ended by host');
                return;
            }

            if (payload.to !== peerId && payload.to !== '*') return;
            const remoteId = payload.from;
            if (payload.name) {
                setPeers((current) => {
                    const identity = { displayName: payload.name!, avatarUrl: payload.avatarUrl };
                    return current.some((peer) => peer.peerId === remoteId)
                        ? current.map((peer) => peer.peerId === remoteId ? { ...peer, ...identity } : peer)
                        : [...current, { peerId: remoteId, ...identity, stream: null }];
                });
            }

            if (payload.type === 'mute') {
                const stream = localStreamRef.current;
                const track = stream?.getAudioTracks()[0];
                if (track) {
                    track.enabled = false;
                    setMicOn(false);
                    setMicLevel(0);
                }
                setRtcError('Muted by host');
                return;
            }

            const polite = politeRef.current.get(remoteId) ?? true;
            const pc = createPeerConnection(remoteId, false);

            try {
                if (payload.type === 'offer' && payload.sdp) {
                    const offerCollision =
                        makingOfferRef.current.has(remoteId) || pc.signalingState !== 'stable';
                    if (offerCollision) {
                        // Perfect negotiation: impolite keeps its offer; polite rolls back.
                        if (!polite) return;
                        try {
                            await pc.setLocalDescription({ type: 'rollback' });
                        } catch {
                            /* some browsers omit rollback — fall through */
                        }
                    }
                    await pc.setRemoteDescription(payload.sdp);
                    await flushPendingIce(remoteId, pc);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    busRef.current?.send('signal', {
                        from: peerId,
                        to: remoteId,
                        type: 'answer',
                        sdp: answer,
                    });
                } else if (payload.type === 'answer' && payload.sdp) {
                    await pc.setRemoteDescription(payload.sdp);
                    await flushPendingIce(remoteId, pc);
                } else if (payload.type === 'ice' && payload.candidate) {
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(payload.candidate).catch(() => {});
                    } else {
                        const queued = pendingIceRef.current.get(remoteId) ?? [];
                        queued.push(payload.candidate);
                        pendingIceRef.current.set(remoteId, queued);
                    }
                }
            } catch (err) {
                console.warn('[FocusRoomRtc] signal', err);
            }
        },
        [createPeerConnection, flushPendingIce, peerId],
    );

    useEffect(() => {
        handleSignalRef.current = (payload) => {
            void handleSignal(payload);
        };
        createPeerConnectionRef.current = createPeerConnection;
        cleanupPeerRef.current = cleanupPeer;
    }, [handleSignal, createPeerConnection, cleanupPeer]);

    const startLocalMedia = useCallback(async (opts?: {
        micId?: string;
        cameraId?: string;
        withVideo?: boolean;
        previewOnly?: boolean;
    }) => {
        const prefs = prefsRef.current;
        try {
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            const audioConstraints: MediaTrackConstraints = {
                deviceId: (opts?.micId || selectedMicId)
                    ? { exact: opts?.micId || selectedMicId }
                    : undefined,
                noiseSuppression: prefs?.noiseSuppression ?? true,
                echoCancellation: prefs?.echoCancellation ?? true,
                autoGainControl: prefs?.autoGainControl ?? true,
            };
            const videoWanted = opts?.withVideo ?? camOn;
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints,
                video: videoWanted
                    ? {
                          deviceId: (opts?.cameraId || selectedCameraId)
                              ? { exact: opts?.cameraId || selectedCameraId }
                              : undefined,
                          width: { ideal: 1280 },
                          height: { ideal: 720 },
                      }
                    : false,
            });
            localStreamRef.current = stream;
            setLocalStream(stream);
            setPermissionState('granted');
            setPreviewReady(true);
            setRtcError('');

            if (audioCtxRef.current?.state !== 'closed') {
                void audioCtxRef.current?.close();
            }
            const ctx = new AudioContext();
            await ctx.resume();
            audioCtxRef.current = ctx;
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyserRef.current = analyser;

            const loop = () => {
                if (!analyserRef.current) return;
                const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(buf);
                const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
                const next = micOn ? Math.min(1, avg / 90) : 0;
                // Quantize so we don't re-render the whole tree at 60fps.
                setMicLevel((prev) => (Math.abs(prev - next) > 0.05 || (next === 0 && prev !== 0) ? next : prev));
                rafRef.current = requestAnimationFrame(loop);
            };
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(loop);

            await refreshDevices();

            if (!opts?.previewOnly) {
                for (const [remoteId, pc] of pcMapRef.current.entries()) {
                    const audioTrack = stream.getAudioTracks()[0] ?? null;
                    const videoTrack = stream.getVideoTracks()[0] ?? null;

                    const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
                    if (audioSender) void audioSender.replaceTrack(audioTrack);
                    else if (audioTrack) pc.addTrack(audioTrack, stream);

                    const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
                    if (videoSender) {
                        // null clears remote video so tiles fall back to the mesh avatar
                        void videoSender.replaceTrack(videoTrack);
                    } else if (videoTrack) {
                        pc.addTrack(videoTrack, stream);
                    }

                    void renegotiate(remoteId);
                }
            }
        } catch {
            setPermissionState('denied');
            setRtcError('Microphone/camera permission denied');
            setPreviewReady(false);
        }
    }, [camOn, micOn, refreshDevices, renegotiate, selectedCameraId, selectedMicId]);

    startLocalMediaRef.current = startLocalMedia;

    // Release camera/microphone whenever the consuming view unmounts.
    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current);
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                void audioCtxRef.current.close();
            }
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!enabled && !roomId) {
            void startLocalMediaRef.current({ previewOnly: true, withVideo: camOnRef.current });
        }
    }, [enabled, roomId]);

    useEffect(() => {
        if (!enabled || !roomId) return;

        let cancelled = false;
        let announceTimer = 0;
        const localPeerId = peerId;

        const connect = async () => {
            // Never block signaling on mic/camera permission — that caused "2 joined · 1 connected".
            void startLocalMediaRef.current({ withVideo: camOnRef.current });

            const handlers: SignalingHandlers = {
                onSignal: (payload) => {
                    handleSignalRef.current(payload);
                },
                onJoin: (join) => {
                    const remoteId = join?.peerId;
                    const name = join?.name;
                    const myId = peerIdRef.current;
                    if (!remoteId || remoteId === myId) return;
                    const myAccount = accountUserIdRef.current;
                    if (myAccount && join.accountUserId && join.accountUserId === myAccount) {
                        setRtcError(
                            'This account is already in the room from another tab. Use a second account to test with two people.',
                        );
                        return;
                    }
                    if (roomLockedRef.current && !isHostRef.current) return;
                    setPeers((prev) => {
                        if (prev.some((p) => p.peerId === remoteId)) return prev;
                        return [...prev, {
                            peerId: remoteId,
                            displayName: name || PENDING_PEER_LABEL,
                            avatarUrl: join.avatarUrl,
                            stream: null,
                        }];
                    });
                    // Exactly one side offers (lexicographically smaller peer id) to avoid glare.
                    const shouldOffer = myId < remoteId;
                    politeRef.current.set(remoteId, !shouldOffer);
                    if (pcMapRef.current.has(remoteId)) return;
                    const pc = createPeerConnectionRef.current(remoteId, shouldOffer);
                    if (!shouldOffer) return;
                    void (async () => {
                        makingOfferRef.current.add(remoteId);
                        try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            busRef.current?.send('signal', {
                                from: myId,
                                to: remoteId,
                                type: 'offer',
                                sdp: offer,
                                name: displayNameRef.current,
                                avatarUrl: avatarUrlRef.current,
                            });
                        } finally {
                            makingOfferRef.current.delete(remoteId);
                        }
                    })();
                },
                onLeave: (payload) => {
                    const remoteId = payload?.peerId;
                    if (remoteId) cleanupPeerRef.current(remoteId);
                },
                onChat: (msg) => {
                    if (msg?.text || msg?.attachment) {
                        setChat((c) => (c.some((x) => x.id === msg.id) ? c : [...c, msg]));
                    }
                },
                onChatDelete: (payload) => {
                    const attachmentId = payload?.attachmentId;
                    if (attachmentId) {
                        setChat((current) =>
                            current.filter((message) => message.attachment?.id !== attachmentId),
                        );
                    }
                },
                onKick: (payload) => {
                    if (payload.to === peerIdRef.current) {
                        setRtcError('Removed from room by host');
                        busRef.current?.close();
                        busRef.current = null;
                    }
                },
            };

            let wsBus: SignalingBus | null = null;
            let rtBus: SignalingBus | null = null;

            const preferred = await resolveFocusRoomWsUrl();
            if (cancelled) return;

            const name = displayNameRef.current;
            const avatar = avatarUrlRef.current;
            const account = accountUserIdRef.current;

            const rtPromise = connectRealtimeSignaling(
                supabase,
                roomId,
                localPeerId,
                name,
                avatar,
                handlers,
                account,
            ).then((result) => result.bus);

            const wsPromise = (async (): Promise<SignalingBus | null> => {
                const urls = signalingUrlAlternates(preferred);
                for (const wsUrl of urls) {
                    if (cancelled) return null;
                    try {
                        const bus = await connectWsSignaling(
                            wsUrl,
                            roomId,
                            localPeerId,
                            name,
                            avatar,
                            handlers,
                            account,
                        );
                        try {
                            localStorage.setItem(FOCUS_ROOM_WS_URL_KEY, DEFAULT_FOCUS_ROOM_WS_URL);
                        } catch {
                            /* ignore */
                        }
                        return bus;
                    } catch (err) {
                        console.warn('[FocusRoomRtc] WS connect failed for', wsUrl, err);
                    }
                }
                return null;
            })();

            const [rtSettled, wsSettled] = await Promise.allSettled([rtPromise, wsPromise]);
            if (cancelled) {
                if (rtSettled.status === 'fulfilled') rtSettled.value.close();
                if (wsSettled.status === 'fulfilled' && wsSettled.value) wsSettled.value.close();
                return;
            }

            if (rtSettled.status === 'fulfilled') {
                rtBus = rtSettled.value;
            } else {
                console.warn('[FocusRoomRtc] Realtime signaling failed', rtSettled.reason);
            }
            if (wsSettled.status === 'fulfilled') {
                wsBus = wsSettled.value;
            }

            if (!rtBus && !wsBus) {
                setRtcError('Could not connect to room signaling');
                return;
            }

            busRef.current = {
                send: (event, payload) => {
                    try {
                        rtBus?.send(event, payload);
                    } catch {
                        /* ignore */
                    }
                    try {
                        wsBus?.send(event, payload);
                    } catch {
                        /* ignore */
                    }
                },
                close: () => {
                    try {
                        rtBus?.close();
                    } catch {
                        /* ignore */
                    }
                    try {
                        wsBus?.close();
                    } catch {
                        /* ignore */
                    }
                },
            };

            setRtcError('');

            const announce = () => {
                busRef.current?.send('join', {
                    peerId: peerIdRef.current,
                    name: displayNameRef.current,
                    avatarUrl: avatarUrlRef.current,
                    accountUserId: accountUserIdRef.current,
                });
            };
            announce();
            announceTimer = window.setInterval(announce, 2500);
        };

        void connect();

        return () => {
            cancelled = true;
            if (announceTimer) window.clearInterval(announceTimer);
            busRef.current?.close();
            busRef.current = null;
            pcMapRef.current.forEach((pc) => pc.close());
            pcMapRef.current.clear();
            dcMapRef.current.clear();
            makingOfferRef.current.clear();
            politeRef.current.clear();
            pendingIceRef.current.clear();
            disconnectTimersRef.current.forEach((timer) => window.clearTimeout(timer));
            disconnectTimersRef.current.clear();
            setPeers([]);
            setChat([]);
        };
        // Identity/profile updates use refs + announce — do not tear down the call.
    }, [enabled, roomId, supabase, peerId]);

    const toggleMic = () => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const track = stream.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setMicOn(track.enabled);
            if (!track.enabled) setMicLevel(0);
        }
    };

    const toggleCam = async () => {
        const next = !camOn;
        camOnRef.current = next;
        setCamOn(next);
        await startLocalMediaRef.current({ withVideo: next });
    };

    const selectMic = async (deviceId: string) => {
        setSelectedMicId(deviceId);
        await startLocalMedia({ micId: deviceId, withVideo: camOn, previewOnly: !enabled });
    };

    const selectSpeaker = (deviceId: string) => {
        setSelectedSpeakerId(deviceId);
    };

    const selectCamera = async (deviceId: string) => {
        setSelectedCameraId(deviceId);
        await startLocalMedia({ cameraId: deviceId, withVideo: true, previewOnly: !enabled });
    };

    // Always show a local tile — even before getUserMedia resolves — so the room never goes blank.
    const allParticipants: RtcPeer[] = [
        {
            peerId,
            displayName: `${displayName} (you)`,
            avatarUrl,
            stream: localStream,
            isLocal: true,
            speaking: micOn && micLevel > 0.12,
        },
        ...peers.map((p) => ({ ...p, speaking: false })),
    ];

    return {
        micOn,
        camOn,
        micLevel,
        toggleMic,
        toggleCam,
        participants: allParticipants,
        rtcError,
        chat,
        sendChat,
        removeChatAttachment,
        kickPeer,
        mutePeer,
        setRoomLock,
        endSession,
        roomLocked,
        isHost,
        audioInputs,
        audioOutputs,
        videoInputs,
        selectedMicId,
        selectedSpeakerId,
        selectedCameraId,
        selectMic,
        selectSpeaker,
        selectCamera,
        startLocalMedia,
        previewReady,
        permissionState,
        refreshDevices,
        localStream,
    };
}

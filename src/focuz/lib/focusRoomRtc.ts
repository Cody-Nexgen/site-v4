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
    onJoin: (payload: { peerId?: string; name?: string; avatarUrl?: string | null }) => void;
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
            bus.send('join', { peerId, name: displayName, avatarUrl });
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
): Promise<{ bus: SignalingBus; channel: RealtimeChannel }> {
    return new Promise((resolve) => {
        const channel = supabase.channel(`focus-room:${roomId}`, {
            config: { broadcast: { self: false } },
        });

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
                handlers.onJoin(payload as { peerId?: string; name?: string; avatarUrl?: string | null });
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
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    bus.send('join', { peerId, name: displayName, avatarUrl });
                    resolve({ bus, channel });
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

    const [peerId] = useState(randomPeerId);
    const busRef = useRef<SignalingBus | null>(null);
    const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const dcMapRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const makingOfferRef = useRef<Set<string>>(new Set());
    const politeRef = useRef<Map<string, boolean>>(new Map());
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number>(0);
    const prefsRef = useRef(joinPrefs);
    const roomLockedRef = useRef(false);

    useEffect(() => {
        prefsRef.current = joinPrefs;
    }, [joinPrefs]);

    useEffect(() => {
        roomLockedRef.current = roomLocked;
    }, [roomLocked]);

    const refreshDevices = useCallback(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
        setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
    }, []);

    const cleanupPeer = useCallback((remoteId: string) => {
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
                const remoteStream = ev.streams[0] ?? new MediaStream([ev.track]);
                setPeers((prev) => {
                    const hit = prev.find((p) => p.peerId === remoteId);
                    if (hit) {
                        return prev.map((p) =>
                            p.peerId === remoteId ? { ...p, stream: remoteStream } : p,
                        );
                    }
                    return [
                        ...prev,
                        { peerId: remoteId, displayName: PENDING_PEER_LABEL, stream: remoteStream },
                    ];
                });
            };

            pc.onnegotiationneeded = () => {
                if (initiator) void renegotiate(remoteId);
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
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
                    const offerCollision = makingOfferRef.current.has(remoteId) || pc.signalingState !== 'stable';
                    if (offerCollision && !polite) return;
                    await pc.setRemoteDescription(payload.sdp);
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
                } else if (payload.type === 'ice' && payload.candidate) {
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(payload.candidate);
                    }
                }
            } catch (err) {
                console.warn('[FocusRoomRtc] signal', err);
            }
        },
        [createPeerConnection, peerId],
    );

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
                    stream.getTracks().forEach((track) => {
                        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
                        if (sender) void sender.replaceTrack(track);
                        else pc.addTrack(track, stream);
                    });
                    void renegotiate(remoteId);
                }
            }
        } catch {
            setPermissionState('denied');
            setRtcError('Microphone/camera permission denied');
            setPreviewReady(false);
        }
    }, [camOn, micOn, refreshDevices, renegotiate, selectedCameraId, selectedMicId]);

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
            void startLocalMedia({ previewOnly: true, withVideo: camOn });
        }
    }, [enabled, roomId, startLocalMedia, camOn]);

    useEffect(() => {
        if (!enabled || !roomId) return;

        let cancelled = false;

        const connect = async () => {
            await startLocalMedia({ withVideo: camOn });
            if (cancelled) return;

            const handlers: SignalingHandlers = {
                onSignal: (payload) => {
                    void handleSignal(payload);
                },
                onJoin: (join) => {
                    const remoteId = join?.peerId;
                    const name = join?.name;
                    if (!remoteId || remoteId === peerId) return;
                    if (roomLockedRef.current && !isHost) return;
                    setPeers((prev) => {
                        if (prev.some((p) => p.peerId === remoteId)) return prev;
                        return [...prev, {
                            peerId: remoteId,
                            displayName: name || PENDING_PEER_LABEL,
                            avatarUrl: join.avatarUrl,
                            stream: null,
                        }];
                    });
                    const pc = createPeerConnection(remoteId, true);
                    void (async () => {
                        makingOfferRef.current.add(remoteId);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        busRef.current?.send('signal', {
                            from: peerId,
                            to: remoteId,
                            type: 'offer',
                            sdp: offer,
                            name: displayName,
                            avatarUrl,
                        });
                        makingOfferRef.current.delete(remoteId);
                    })();
                },
                onLeave: (payload) => {
                    const remoteId = payload?.peerId;
                    if (remoteId) cleanupPeer(remoteId);
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
                    if (payload.to === peerId) {
                        setRtcError('Removed from room by host');
                        busRef.current?.close();
                        busRef.current = null;
                    }
                },
            };

            const preferred = await resolveFocusRoomWsUrl();
            if (cancelled) return;

            let connected = false;
            const urls = signalingUrlAlternates(preferred);
            // Two full passes before Realtime — recovers from brief VPS/Caddy blips.
            for (let attempt = 0; attempt < 2 && !connected && !cancelled; attempt += 1) {
                if (attempt > 0) {
                    await new Promise((r) => window.setTimeout(r, 700 * attempt));
                }
                for (const wsUrl of urls) {
                    if (cancelled || connected) break;
                    try {
                        const bus = await connectWsSignaling(
                            wsUrl,
                            roomId,
                            peerId,
                            displayName,
                            avatarUrl,
                            handlers,
                        );
                        if (cancelled) {
                            bus.close();
                            return;
                        }
                        busRef.current = bus;
                        connected = true;
                        try {
                            localStorage.setItem(FOCUS_ROOM_WS_URL_KEY, DEFAULT_FOCUS_ROOM_WS_URL);
                        } catch {
                            /* ignore */
                        }
                        try {
                            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                                void chrome.storage.local.set({
                                    [FOCUS_ROOM_WS_URL_KEY]: DEFAULT_FOCUS_ROOM_WS_URL,
                                });
                            }
                        } catch {
                            /* ignore */
                        }
                    } catch (err) {
                        console.warn('[FocusRoomRtc] WS connect failed for', wsUrl, err);
                    }
                }
            }

            if (!connected) {
                console.warn('[FocusRoomRtc] WS signaling failed after retries, falling back to Realtime');
                try {
                    const { bus } = await connectRealtimeSignaling(
                        supabase,
                        roomId,
                        peerId,
                        displayName,
                        avatarUrl,
                        handlers,
                    );
                    if (cancelled) {
                        bus.close();
                        return;
                    }
                    busRef.current = bus;
                } catch (fallbackErr) {
                    console.warn('[FocusRoomRtc] signaling connect failed', fallbackErr);
                    setRtcError('Could not connect to room signaling');
                }
            }
        };

        void connect();

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafRef.current);
            void audioCtxRef.current?.close();
            busRef.current?.close();
            busRef.current = null;
            pcMapRef.current.forEach((pc) => pc.close());
            pcMapRef.current.clear();
            dcMapRef.current.clear();
            makingOfferRef.current.clear();
            politeRef.current.clear();
            if (enabled) {
                localStreamRef.current?.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
                setLocalStream(null);
            }
            setPeers([]);
            setChat([]);
        };
    }, [enabled, roomId, supabase, displayName, avatarUrl, handleSignal, createPeerConnection, cleanupPeer, startLocalMedia, camOn, isHost, peerId]);

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
        setCamOn(next);
        await startLocalMedia({ withVideo: next });
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

    const allParticipants: RtcPeer[] = [
        ...(localStream
            ? [{
                peerId,
                displayName: `${displayName} (you)`,
                avatarUrl,
                stream: localStream,
                isLocal: true,
                speaking: micOn && micLevel > 0.12,
            }]
            : []),
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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { AttachmentRecord } from './attachmentApi';

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

function randomPeerId() {
    return `peer_${Math.random().toString(36).slice(2, 10)}`;
}

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

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
    const channelRef = useRef<RealtimeChannel | null>(null);
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
        const channel = channelRef.current;
        if (channel) {
            void channel.send({ type: 'broadcast', event: 'chat', payload: msg });
        }
    }, [displayName]);

    const removeChatAttachment = useCallback((attachmentId: string) => {
        setChat((current) => current.filter((message) => message.attachment?.id !== attachmentId));
        const channel = channelRef.current;
        if (channel) {
            void channel.send({
                type: 'broadcast',
                event: 'chat-delete',
                payload: { attachmentId },
            });
        }
    }, []);

    const renegotiate = useCallback(async (remoteId: string, channel: RealtimeChannel) => {
        const pc = pcMapRef.current.get(remoteId);
        if (!pc || makingOfferRef.current.has(remoteId)) return;
        try {
            makingOfferRef.current.add(remoteId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: {
                    from: peerId,
                    to: remoteId,
                    type: 'offer',
                    sdp: offer,
                    name: displayName,
                    avatarUrl,
                } satisfies SignalPayload,
            });
        } catch (err) {
            console.warn('[FocusRoomRtc] renegotiate', err);
        } finally {
            makingOfferRef.current.delete(remoteId);
        }
    }, [displayName, avatarUrl]);

    const kickPeer = useCallback(
        (remoteId: string) => {
            if (!isHost) return;
            const channel = channelRef.current;
            if (channel) {
                void channel.send({
                    type: 'broadcast',
                    event: 'kick',
                    payload: { from: peerId, to: remoteId },
                });
            }
            cleanupPeer(remoteId);
        },
        [isHost, cleanupPeer],
    );

    const mutePeer = useCallback(
        (remoteId: string) => {
            if (!isHost) return;
            const channel = channelRef.current;
            if (channel) {
                void channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { from: peerId, to: remoteId, type: 'mute' } satisfies SignalPayload,
                });
            }
            setPeers((prev) =>
                prev.map((p) => (p.peerId === remoteId ? { ...p, mutedByHost: true } : p)),
            );
        },
        [isHost],
    );

    const setRoomLock = useCallback(
        (locked: boolean) => {
            if (!isHost) return;
            setRoomLocked(locked);
            const channel = channelRef.current;
            if (channel) {
                void channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { from: peerId, to: '*', type: 'room-lock', locked } satisfies SignalPayload,
                });
            }
        },
        [isHost],
    );

    const endSession = useCallback(() => {
        if (!isHost) return;
        const channel = channelRef.current;
        if (channel) {
            void channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { from: peerId, to: '*', type: 'end-session' } satisfies SignalPayload,
            });
        }
    }, [isHost]);

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
                            name: data.name || remoteId.slice(0, 6),
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
        (remoteId: string, channel: RealtimeChannel, initiator: boolean) => {
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
                void channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: {
                        from: peerId,
                        to: remoteId,
                        type: 'ice',
                        candidate: ev.candidate.toJSON(),
                    } satisfies SignalPayload,
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
                        { peerId: remoteId, displayName: remoteId.slice(0, 8), stream: remoteStream },
                    ];
                });
            };

            pc.onnegotiationneeded = () => {
                if (initiator) void renegotiate(remoteId, channel);
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    cleanupPeer(remoteId);
                }
            };

            pcMapRef.current.set(remoteId, pc);
            return pc;
        },
        [cleanupPeer, wireDataChannel, renegotiate],
    );

    const handleSignal = useCallback(
        async (payload: SignalPayload, channel: RealtimeChannel) => {
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
            const pc = createPeerConnection(remoteId, channel, false);

            try {
                if (payload.type === 'offer' && payload.sdp) {
                    const offerCollision = makingOfferRef.current.has(remoteId) || pc.signalingState !== 'stable';
                    if (offerCollision && !polite) return;
                    await pc.setRemoteDescription(payload.sdp);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await channel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: {
                            from: peerId,
                            to: remoteId,
                            type: 'answer',
                            sdp: answer,
                        } satisfies SignalPayload,
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
        [createPeerConnection],
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
                    void renegotiate(remoteId, channelRef.current!);
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

            const channel = supabase.channel(`focus-room:${roomId}`, {
                config: { broadcast: { self: false } },
            });

            channel
                .on('broadcast', { event: 'signal' }, ({ payload }) => {
                    void handleSignal(payload as SignalPayload, channel);
                })
                .on('broadcast', { event: 'join' }, ({ payload }) => {
                    const join = payload as { peerId?: string; name?: string; avatarUrl?: string | null };
                    const remoteId = join?.peerId;
                    const name = join?.name;
                    if (!remoteId || remoteId === peerId) return;
                    if (roomLockedRef.current && !isHost) return;
                    setPeers((prev) => {
                        if (prev.some((p) => p.peerId === remoteId)) return prev;
                        return [...prev, {
                            peerId: remoteId,
                            displayName: name || remoteId.slice(0, 8),
                            avatarUrl: join.avatarUrl,
                            stream: null,
                        }];
                    });
                    const pc = createPeerConnection(remoteId, channel, true);
                    void (async () => {
                        makingOfferRef.current.add(remoteId);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        await channel.send({
                            type: 'broadcast',
                            event: 'signal',
                            payload: {
                                from: peerId,
                                to: remoteId,
                                type: 'offer',
                                sdp: offer,
                                name: displayName,
                                avatarUrl,
                            } satisfies SignalPayload,
                        });
                        makingOfferRef.current.delete(remoteId);
                    })();
                })
                .on('broadcast', { event: 'leave' }, ({ payload }) => {
                    const remoteId = (payload as { peerId?: string })?.peerId;
                    if (remoteId) cleanupPeer(remoteId);
                })
                .on('broadcast', { event: 'chat' }, ({ payload }) => {
                    const msg = payload as ChatMessage;
                    if (msg?.text || msg?.attachment) {
                        setChat((c) => (c.some((x) => x.id === msg.id) ? c : [...c, msg]));
                    }
                })
                .on('broadcast', { event: 'chat-delete' }, ({ payload }) => {
                    const attachmentId = (payload as { attachmentId?: string })?.attachmentId;
                    if (attachmentId) {
                        setChat((current) =>
                            current.filter((message) => message.attachment?.id !== attachmentId),
                        );
                    }
                })
                .on('broadcast', { event: 'kick' }, ({ payload }) => {
                    const p = payload as { to?: string };
                    if (p.to === peerId) {
                        setRtcError('Removed from room by host');
                        void supabase.removeChannel(channel);
                    }
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.send({
                            type: 'broadcast',
                            event: 'join',
                            payload: { peerId, name: displayName, avatarUrl },
                        });
                    }
                });

            channelRef.current = channel;
        };

        void connect();

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafRef.current);
            void audioCtxRef.current?.close();
            const channel = channelRef.current;
            if (channel) {
                void channel.send({
                    type: 'broadcast',
                    event: 'leave',
                    payload: { peerId },
                });
                void supabase.removeChannel(channel);
            }
            channelRef.current = null;
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
    }, [enabled, roomId, supabase, displayName, avatarUrl, handleSignal, createPeerConnection, cleanupPeer, startLocalMedia, camOn, isHost]);

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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type RtcPeer = {
    peerId: string;
    displayName: string;
    avatarUrl?: string | null;
    stream: MediaStream | null;
    isLocal?: boolean;
    speaking?: boolean;
};

export type ChatMessage = {
    id: string;
    from: string;
    name: string;
    text: string;
    at: number;
};

type SignalPayload = {
    from: string;
    to: string;
    type: 'offer' | 'answer' | 'ice' | 'chat' | 'kick';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    text?: string;
    name?: string;
};

function randomPeerId() {
    return `peer_${Math.random().toString(36).slice(2, 10)}`;
}

export function useFocusRoomRtc(
    supabase: SupabaseClient,
    roomId: string | null,
    displayName: string,
    enabled: boolean,
    isHost: boolean,
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
    const [selectedMicId, setSelectedMicId] = useState('');
    const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
    const [showDeviceMenu, setShowDeviceMenu] = useState(false);

    const peerIdRef = useRef(randomPeerId());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const dcMapRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number>(0);

    const cleanupPeer = useCallback((remoteId: string) => {
        const pc = pcMapRef.current.get(remoteId);
        if (pc) {
            pc.close();
            pcMapRef.current.delete(remoteId);
        }
        dcMapRef.current.delete(remoteId);
        setPeers((prev) => prev.filter((p) => p.peerId !== remoteId));
    }, []);

    const sendChat = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const msg: ChatMessage = {
            id: `${Date.now()}`,
            from: peerIdRef.current,
            name: displayName,
            text: trimmed,
            at: Date.now(),
        };
        setChat((c) => [...c, msg]);
        const channel = channelRef.current;
        if (channel) {
            void channel.send({
                type: 'broadcast',
                event: 'chat',
                payload: msg,
            });
        }
        dcMapRef.current.forEach((dc) => {
            if (dc.readyState === 'open') dc.send(JSON.stringify({ type: 'chat', ...msg }));
        });
    }, [displayName]);

    const kickPeer = useCallback(
        (remoteId: string) => {
            if (!isHost) return;
            const channel = channelRef.current;
            if (channel) {
                void channel.send({
                    type: 'broadcast',
                    event: 'kick',
                    payload: { from: peerIdRef.current, to: remoteId },
                });
            }
            cleanupPeer(remoteId);
        },
        [isHost, cleanupPeer],
    );

    const wireDataChannel = useCallback(
        (dc: RTCDataChannel, remoteId: string) => {
            dcMapRef.current.set(remoteId, dc);
            dc.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data as string) as ChatMessage & { type?: string };
                    if (data.type === 'chat' && data.text) {
                        setChat((c) => [
                            ...c,
                            {
                                id: data.id || `${Date.now()}`,
                                from: remoteId,
                                name: data.name || remoteId.slice(0, 6),
                                text: data.text,
                                at: data.at || Date.now(),
                            },
                        ]);
                    }
                    if (data.type === 'kick' && data.from && isHost) {
                        /* host only sends kicks */
                    }
                } catch {
                    /* ignore */
                }
            };
        },
        [isHost],
    );

    const createPeerConnection = useCallback(
        (remoteId: string, channel: RealtimeChannel, initiator: boolean) => {
            if (pcMapRef.current.has(remoteId)) return pcMapRef.current.get(remoteId)!;

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });

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
                        from: peerIdRef.current,
                        to: remoteId,
                        type: 'ice',
                        candidate: ev.candidate.toJSON(),
                    } satisfies SignalPayload,
                });
            };

            pc.ontrack = (ev) => {
                const remoteStream = ev.streams[0] ?? null;
                setPeers((prev) => {
                    const existing = prev.find((p) => p.peerId === remoteId);
                    if (existing) {
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

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    cleanupPeer(remoteId);
                }
            };

            pcMapRef.current.set(remoteId, pc);
            return pc;
        },
        [cleanupPeer, wireDataChannel],
    );

    const handleSignal = useCallback(
        async (payload: SignalPayload, channel: RealtimeChannel) => {
            if (!payload || payload.to !== peerIdRef.current) return;
            const remoteId = payload.from;
            const pc = createPeerConnection(remoteId, channel, false);

            try {
                if (payload.type === 'offer' && payload.sdp) {
                    await pc.setRemoteDescription(payload.sdp);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await channel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: {
                            from: peerIdRef.current,
                            to: remoteId,
                            type: 'answer',
                            sdp: answer,
                        } satisfies SignalPayload,
                    });
                } else if (payload.type === 'answer' && payload.sdp) {
                    await pc.setRemoteDescription(payload.sdp);
                } else if (payload.type === 'ice' && payload.candidate) {
                    await pc.addIceCandidate(payload.candidate);
                }
            } catch (err) {
                console.warn('[FocusRoomRtc]', err);
            }
        },
        [createPeerConnection],
    );

    const startLocalMedia = useCallback(async (micId?: string, withVideo?: boolean) => {
        try {
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: micId ? { deviceId: { exact: micId } } : true,
                video: withVideo ?? camOn,
            });
            localStreamRef.current = stream;
            setLocalStream(stream);

            if (audioCtxRef.current) void audioCtxRef.current.close();
            const ctx = new AudioContext();
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
                setMicLevel(micOn ? Math.min(1, avg / 90) : 0);
                rafRef.current = requestAnimationFrame(loop);
            };
                cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(loop);

            setRtcError('');
            pcMapRef.current.forEach((pc) => {
                stream.getTracks().forEach((track) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
                    if (sender) void sender.replaceTrack(track);
                    else pc.addTrack(track, stream);
                });
            });
        } catch {
            setRtcError('Microphone/camera permission denied');
        }
    }, [camOn, micOn]);

    useEffect(() => {
        void navigator.mediaDevices.enumerateDevices().then((devices) => {
            setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
            setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
        });
    }, [localStream]);

    useEffect(() => {
        if (!enabled || !roomId) return;

        void startLocalMedia(selectedMicId || undefined);

        const channel = supabase.channel(`focus-room:${roomId}`, {
            config: { broadcast: { self: false } },
        });

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                void handleSignal(payload as SignalPayload, channel);
            })
            .on('broadcast', { event: 'join' }, ({ payload }) => {
                const remoteId = (payload as { peerId?: string; name?: string })?.peerId;
                const name = (payload as { name?: string })?.name;
                if (!remoteId || remoteId === peerIdRef.current) return;
                setPeers((prev) => {
                    if (prev.some((p) => p.peerId === remoteId)) return prev;
                    return [...prev, { peerId: remoteId, displayName: name || remoteId.slice(0, 8), stream: null }];
                });
                const pc = createPeerConnection(remoteId, channel, true);
                void (async () => {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    await channel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: {
                            from: peerIdRef.current,
                            to: remoteId,
                            type: 'offer',
                            sdp: offer,
                        } satisfies SignalPayload,
                    });
                })();
            })
            .on('broadcast', { event: 'leave' }, ({ payload }) => {
                const remoteId = (payload as { peerId?: string })?.peerId;
                if (remoteId) cleanupPeer(remoteId);
            })
            .on('broadcast', { event: 'chat' }, ({ payload }) => {
                const msg = payload as ChatMessage;
                if (msg?.text) setChat((c) => (c.some((x) => x.id === msg.id) ? c : [...c, msg]));
            })
            .on('broadcast', { event: 'kick' }, ({ payload }) => {
                const p = payload as { to?: string };
                if (p.to === peerIdRef.current) {
                    setRtcError('Removed from room by host');
                    void supabase.removeChannel(channel);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'join',
                        payload: { peerId: peerIdRef.current, name: displayName },
                    });
                }
            });

        channelRef.current = channel;

        return () => {
            cancelAnimationFrame(rafRef.current);
            void audioCtxRef.current?.close();
            void channel.send({
                type: 'broadcast',
                event: 'leave',
                payload: { peerId: peerIdRef.current },
            });
            void supabase.removeChannel(channel);
            channelRef.current = null;
            pcMapRef.current.forEach((pc) => pc.close());
            pcMapRef.current.clear();
            dcMapRef.current.clear();
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
            setLocalStream(null);
            setPeers([]);
            setChat([]);
        };
    }, [enabled, roomId, supabase, displayName, handleSignal, createPeerConnection, cleanupPeer, startLocalMedia, selectedMicId]);

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
        await startLocalMedia(selectedMicId || undefined, next);
    };

    const selectMic = async (deviceId: string) => {
        setSelectedMicId(deviceId);
        await startLocalMedia(deviceId, camOn);
        setShowDeviceMenu(false);
    };

    const allParticipants: RtcPeer[] = [
        ...(localStream
            ? [{
                peerId: peerIdRef.current,
                displayName: `${displayName} (you)`,
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
        kickPeer,
        isHost,
        audioInputs,
        audioOutputs,
        selectedMicId,
        selectedSpeakerId,
        setSelectedSpeakerId,
        selectMic,
        showDeviceMenu,
        setShowDeviceMenu,
    };
}

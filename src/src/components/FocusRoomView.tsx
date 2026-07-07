import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    ChevronDown,
    Copy,
    DoorOpen,
    Loader2,
    MessageSquare,
    Mic,
    MicOff,
    MoreVertical,
    Users,
    Video,
    VideoOff,
    X,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import {
    createFocusRoom,
    focusRoomUrl,
    FOCUS_ROOM_STORAGE_KEY,
    getFocusRoom,
    joinFocusRoom,
    leaveFocusRoom,
    type FocusRoom,
} from '../lib/socialApi';
import { useFocusRoomRtc } from '../lib/focusRoomRtc';
import {
    PROFILE_AVATAR_FALLBACK_CLASS,
    PROFILE_AVATAR_IMG_CLASS,
} from '../lib/profileAvatar';

function formatCountdown(endsAt: string): string {
    const sec = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function MicButton({
    micOn,
    level,
    onClick,
    onDeviceClick,
}: {
    micOn: boolean;
    level: number;
    onClick: () => void;
    onDeviceClick: () => void;
}) {
    return (
        <div className="flex items-center gap-0.5">
            <button
                type="button"
                onClick={onClick}
                className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    micOn ? 'bg-[#2b2d31] hover:bg-[#35373c]' : 'bg-red-500/25 hover:bg-red-500/35'
                }`}
                title={micOn ? 'Mute' : 'Unmute'}
            >
                {micOn ? (
                    <div className="relative">
                        <Mic size={20} className="text-[#dbdee1]" />
                        <div
                            className="absolute inset-0 bg-emerald-400/80 rounded-sm origin-bottom transition-transform"
                            style={{
                                transform: `scaleY(${0.15 + level * 0.85})`,
                                clipPath: 'inset(0 0 0 0)',
                                mixBlendMode: 'screen',
                                opacity: level > 0.08 ? 0.9 : 0,
                            }}
                        />
                    </div>
                ) : (
                    <>
                        <MicOff size={20} className="text-red-400 relative z-10" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-8 h-[2px] bg-red-500 rotate-45 rounded-full" />
                        </div>
                    </>
                )}
            </button>
            <button
                type="button"
                onClick={onDeviceClick}
                className="w-6 h-12 rounded-r-full bg-[#2b2d31] hover:bg-[#35373c] flex items-center justify-center text-[#949ba4]"
            >
                <ChevronDown size={14} />
            </button>
        </div>
    );
}

function CamButton({ camOn, onClick }: { camOn: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                camOn ? 'bg-[#2b2d31] hover:bg-[#35373c]' : 'bg-red-500/25 hover:bg-red-500/35'
            }`}
        >
            {camOn ? (
                <Video size={20} className="text-[#dbdee1]" />
            ) : (
                <>
                    <VideoOff size={20} className="text-red-400 relative z-10" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-[2px] bg-red-500 rotate-45 rounded-full" />
                    </div>
                </>
            )}
        </button>
    );
}

function ParticipantTile({
    stream,
    label,
    avatarUrl,
    isLocal,
    camOn,
}: {
    stream: MediaStream | null;
    label: string;
    avatarUrl?: string | null;
    isLocal?: boolean;
    camOn: boolean;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    const hasVideo = camOn && (stream?.getVideoTracks().some((t) => t.enabled) ?? false);

    useEffect(() => {
        const el = ref.current;
        if (el) el.srcObject = hasVideo ? stream : null;
    }, [stream, hasVideo]);

    return (
        <div className="relative aspect-video rounded-lg overflow-hidden bg-[#1e1f22] border border-[#2b2d31]">
            {hasVideo ? (
                <video ref={ref} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#2b2d31] to-[#1e1f22]">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className={`${PROFILE_AVATAR_IMG_CLASS} !w-20 !h-20`} />
                    ) : (
                        <div className={`${PROFILE_AVATAR_FALLBACK_CLASS} !w-20 !h-20 !text-2xl`}>
                            {label.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-xs font-semibold text-[#dbdee1]">
                {label}
            </div>
        </div>
    );
}

type Props = {
    onBack?: () => void;
};

export default function FocusRoomView({ onBack }: Props) {
    const { session, engineState } = useAuthStore();
    const [roomId, setRoomId] = useState<string | null>(null);
    const [room, setRoom] = useState<FocusRoom | null>(null);
    const [title, setTitle] = useState('Focus Room');
    const [durationMin, setDurationMin] = useState(25);
    const [joinInput, setJoinInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState('');
    const [copied, setCopied] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [hostOpen, setHostOpen] = useState(false);
    const [chatDraft, setChatDraft] = useState('');

    const displayName =
        engineState.profileName?.trim() ||
        session?.user?.user_metadata?.full_name ||
        session?.user?.email?.split('@')[0] ||
        'Focus';

    const tokens =
        session?.access_token && session?.refresh_token
            ? { access_token: session.access_token, refresh_token: session.refresh_token }
            : null;

    const isHost = !!room && !!session && room.members.some((m) => m.displayName === displayName);

    const rtc = useFocusRoomRtc(supabase, roomId, displayName, !!(room && roomId), isHost);

    const pollRoom = useCallback(async (id: string) => {
        const res = await getFocusRoom(supabase, id);
        if (res.ok && res.room) {
            setRoom(res.room);
            setCountdown(formatCountdown(res.room.endsAt));
        } else {
            setRoom(null);
            setRoomId(null);
            await chrome.storage.local.remove(FOCUS_ROOM_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        void chrome.storage.local.get(FOCUS_ROOM_STORAGE_KEY).then((r) => {
            const id = r[FOCUS_ROOM_STORAGE_KEY] as string | undefined;
            if (id) setRoomId(id);
        });
    }, []);

    useEffect(() => {
        if (!roomId) return;
        void pollRoom(roomId);
        const poll = window.setInterval(() => void pollRoom(roomId), 5000);
        const tick = window.setInterval(() => {
            if (room?.endsAt) setCountdown(formatCountdown(room.endsAt));
        }, 1000);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [roomId, room?.endsAt, pollRoom]);

    const handleCreate = async () => {
        if (!session) return;
        setLoading(true);
        const res = await createFocusRoom(supabase, title, durationMin, tokens);
        setLoading(false);
        if (res.ok && res.roomId) {
            setRoomId(res.roomId);
            await chrome.storage.local.set({ [FOCUS_ROOM_STORAGE_KEY]: res.roomId });
            void pollRoom(res.roomId);
        } else setError(res.error ?? 'Could not create room');
    };

    const handleJoin = async (id?: string) => {
        const rid = (id ?? joinInput).trim();
        if (!rid || !session) return;
        setLoading(true);
        const res = await joinFocusRoom(supabase, rid, tokens);
        setLoading(false);
        if (res.ok) {
            setRoomId(rid);
            await chrome.storage.local.set({ [FOCUS_ROOM_STORAGE_KEY]: rid });
            void pollRoom(rid);
        } else setError(res.error ?? 'Join failed');
    };

    const handleLeave = async () => {
        if (!roomId) return;
        await leaveFocusRoom(supabase, roomId, tokens);
        setRoom(null);
        setRoomId(null);
        await chrome.storage.local.remove(FOCUS_ROOM_STORAGE_KEY);
        onBack?.();
    };

    const shareUrl = roomId ? focusRoomUrl(roomId) : '';

    if (!session) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#1e1f22] text-[#dbdee1]">
                <p>Sign in to use focus rooms.</p>
            </div>
        );
    }

    if (!room || !roomId) {
        return (
            <div className="h-screen bg-[#1e1f22] text-[#dbdee1] flex flex-col">
                {onBack && (
                    <button type="button" onClick={onBack} className="m-4 flex items-center gap-2 text-sm text-[#949ba4] hover:text-white w-fit">
                        <ArrowLeft size={16} /> Back
                    </button>
                )}
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="w-full max-w-md space-y-6">
                        <div className="text-center">
                            <Users size={40} className="mx-auto text-[#5865f2] mb-3" />
                            <h1 className="text-2xl font-bold text-white">Focus Room</h1>
                            <p className="text-sm text-[#949ba4] mt-2">Voice + video co-focus. Share focuznow.com/room links.</p>
                        </div>
                        <div className="grid gap-4">
                            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Room name" className="w-full bg-[#2b2d31] border border-[#1e1f22] rounded-lg px-4 py-3 text-white outline-none focus:border-[#5865f2]" />
                            <input type="number" min={5} max={180} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 25)} className="w-full bg-[#2b2d31] border border-[#1e1f22] rounded-lg px-4 py-3 text-white outline-none" />
                            <button type="button" disabled={loading} onClick={() => void handleCreate()} className="w-full py-3 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] font-bold text-white disabled:opacity-50">
                                {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Create room'}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Room ID" className="flex-1 bg-[#2b2d31] rounded-lg px-4 py-3 text-white font-mono text-sm outline-none" />
                            <button type="button" disabled={loading} onClick={() => void handleJoin()} className="px-4 py-3 rounded-lg bg-[#35373c] hover:bg-[#404249] font-bold">Join</button>
                        </div>
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-[#1e1f22] text-[#dbdee1] overflow-hidden">
            <header className="h-12 px-4 flex items-center justify-between border-b border-[#111214] bg-[#1e1f22] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {onBack && (
                        <button type="button" onClick={onBack} className="text-[#949ba4] hover:text-white">
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-white truncate">{room.title}</span>
                    <span className="text-xs text-[#949ba4]">{room.participantCount} in room</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-[#5865f2] tabular-nums">{countdown}</span>
                    <button
                        type="button"
                        onClick={() => {
                            void navigator.clipboard.writeText(shareUrl).then(() => {
                                setCopied(true);
                                window.setTimeout(() => setCopied(false), 2000);
                            });
                        }}
                        className="text-xs font-bold text-[#949ba4] hover:text-white flex items-center gap-1"
                    >
                        <Copy size={12} /> {copied ? 'Copied' : 'Invite'}
                    </button>
                </div>
            </header>

            <main className="flex-1 min-h-0 flex">
                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-6xl mx-auto">
                        {rtc.participants.map((p) => (
                            <ParticipantTile
                                key={p.peerId}
                                stream={p.stream}
                                label={p.displayName}
                                isLocal={p.isLocal}
                                camOn={p.isLocal ? rtc.camOn : !!p.stream?.getVideoTracks().some((t) => t.enabled)}
                            />
                        ))}
                        {room.members
                            .filter((m) => !rtc.participants.some((p) => p.displayName.startsWith(m.displayName.split(' ')[0])))
                            .map((m) => (
                                <ParticipantTile
                                    key={m.username}
                                    stream={null}
                                    label={m.displayName}
                                    avatarUrl={m.avatarUrl}
                                    camOn={false}
                                />
                            ))}
                    </div>
                </div>

                {chatOpen && (
                    <aside className="w-72 border-l border-[#111214] bg-[#2b2d31] flex flex-col shrink-0">
                        <div className="h-12 px-3 flex items-center justify-between border-b border-[#1e1f22]">
                            <span className="font-bold text-sm">Chat</span>
                            <button type="button" onClick={() => setChatOpen(false)}><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
                            {rtc.chat.map((m) => (
                                <div key={m.id}>
                                    <span className="font-bold text-[#5865f2] text-xs">{m.name}</span>
                                    <p className="text-[#dbdee1]">{m.text}</p>
                                </div>
                            ))}
                        </div>
                        <form
                            className="p-3 border-t border-[#1e1f22] flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                rtc.sendChat(chatDraft);
                                setChatDraft('');
                            }}
                        >
                            <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Message…" className="flex-1 bg-[#1e1f22] rounded px-3 py-2 text-sm outline-none" />
                        </form>
                    </aside>
                )}
            </main>

            <footer className="h-[72px] px-4 flex items-center justify-center gap-3 bg-[#1e1f22] border-t border-[#111214] shrink-0 relative">
                {rtc.showDeviceMenu && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64 bg-[#111214] border border-[#2b2d31] rounded-lg shadow-xl p-2 z-50">
                        <p className="text-[10px] font-bold uppercase text-[#949ba4] px-2 py-1">Microphone</p>
                        {rtc.audioInputs.map((d) => (
                            <button key={d.deviceId} type="button" onClick={() => void rtc.selectMic(d.deviceId)} className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[#35373c] truncate">
                                {d.label || 'Mic'}
                            </button>
                        ))}
                    </div>
                )}
                <MicButton micOn={rtc.micOn} level={rtc.micLevel} onClick={rtc.toggleMic} onDeviceClick={() => rtc.setShowDeviceMenu(!rtc.showDeviceMenu)} />
                <CamButton camOn={rtc.camOn} onClick={() => void rtc.toggleCam()} />
                <button type="button" onClick={() => setChatOpen((o) => !o)} className="w-12 h-12 rounded-full bg-[#2b2d31] hover:bg-[#35373c] flex items-center justify-center">
                    <MessageSquare size={20} />
                </button>
                {isHost && (
                    <div className="relative">
                        <button type="button" onClick={() => setHostOpen((o) => !o)} className="w-12 h-12 rounded-full bg-[#2b2d31] hover:bg-[#35373c] flex items-center justify-center">
                            <MoreVertical size={20} />
                        </button>
                        {hostOpen && (
                            <div className="absolute bottom-14 right-0 w-48 bg-[#111214] border border-[#2b2d31] rounded-lg shadow-xl p-1 z-50">
                                <p className="text-[10px] font-bold uppercase text-[#949ba4] px-2 py-1">Host</p>
                                {rtc.participants.filter((p) => !p.isLocal).map((p) => (
                                    <button key={p.peerId} type="button" onClick={() => { rtc.kickPeer(p.peerId); setHostOpen(false); }} className="w-full text-left px-2 py-1.5 rounded text-sm text-red-400 hover:bg-[#35373c]">
                                        Remove {p.displayName}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <button type="button" onClick={() => void handleLeave()} className="ml-4 px-4 h-10 rounded-lg bg-red-500 hover:bg-red-600 font-bold text-white flex items-center gap-2">
                    <DoorOpen size={16} /> Leave
                </button>
            </footer>
            {rtc.rtcError && <p className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-amber-400 bg-black/60 px-3 py-1 rounded">{rtc.rtcError}</p>}
        </div>
    );
}

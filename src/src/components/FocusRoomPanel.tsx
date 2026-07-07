import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Copy,
    DoorOpen,
    ExternalLink,
    Loader2,
    Mic,
    MicOff,
    Users,
    Video,
    VideoOff,
} from 'lucide-react';
import { GlassCard } from '../options/OptionsApp';
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

function VideoTile({
    stream,
    label,
    isLocal,
}: {
    stream: MediaStream | null;
    label: string;
    isLocal?: boolean;
}) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.srcObject = stream;
    }, [stream]);

    const hasVideo = stream?.getVideoTracks().some((t) => t.enabled) ?? false;

    return (
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1a1a1f] border border-white/8 shadow-lg">
            {hasVideo ? (
                <video
                    ref={ref}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
                    <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-xl font-black text-white/80">
                        {label.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] font-bold text-white">
                {label}
            </div>
        </div>
    );
}

export default function FocusRoomPanel() {
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

    const displayName =
        engineState.profileName?.trim() ||
        session?.user?.user_metadata?.full_name ||
        session?.user?.email?.split('@')[0] ||
        'Focus';

    const tokens =
        session?.access_token && session?.refresh_token
            ? { access_token: session.access_token, refresh_token: session.refresh_token }
            : null;

    const rtc = useFocusRoomRtc(supabase, roomId, displayName, !!(room && roomId), false);

    const loadStoredRoom = useCallback(async () => {
        const stored = await chrome.storage.local.get(FOCUS_ROOM_STORAGE_KEY);
        const id = stored[FOCUS_ROOM_STORAGE_KEY] as string | undefined;
        if (id) setRoomId(id);
    }, []);

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
        void loadStoredRoom();
    }, [loadStoredRoom]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get('room');
        if (!fromUrl || !session) return;
        setJoinInput(fromUrl);
        void (async () => {
            setLoading(true);
            setError('');
            const res = await joinFocusRoom(supabase, fromUrl, tokens);
            setLoading(false);
            if (res.ok) {
                setRoomId(fromUrl);
                await chrome.storage.local.set({ [FOCUS_ROOM_STORAGE_KEY]: fromUrl });
                void pollRoom(fromUrl);
            } else {
                setError(res.error === 'ROOM_NOT_FOUND' ? 'Room not found or expired' : res.error ?? 'Join failed');
            }
        })();
    }, [session, tokens, pollRoom]);

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
        setError('');
        const res = await createFocusRoom(supabase, title, durationMin, tokens);
        setLoading(false);
        if (res.ok && res.roomId) {
            setRoomId(res.roomId);
            await chrome.storage.local.set({ [FOCUS_ROOM_STORAGE_KEY]: res.roomId });
            void pollRoom(res.roomId);
        } else {
            setError(res.error ?? 'Could not create room');
        }
    };

    const handleJoin = async (idOverride?: string) => {
        const id = (idOverride ?? joinInput).trim();
        if (!id || !session) return;
        setLoading(true);
        setError('');
        const res = await joinFocusRoom(supabase, id, tokens);
        setLoading(false);
        if (res.ok) {
            setRoomId(id);
            await chrome.storage.local.set({ [FOCUS_ROOM_STORAGE_KEY]: id });
            void pollRoom(id);
        } else {
            setError(res.error === 'ROOM_NOT_FOUND' ? 'Room not found or expired' : res.error ?? 'Join failed');
        }
    };

    const handleLeave = async () => {
        if (!roomId) return;
        await leaveFocusRoom(supabase, roomId, tokens);
        setRoom(null);
        setRoomId(null);
        await chrome.storage.local.remove(FOCUS_ROOM_STORAGE_KEY);
    };

    const shareUrl = roomId ? focusRoomUrl(roomId) : '';

    const copyLink = () => {
        if (!shareUrl) return;
        void navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!session) {
        return (
            <GlassCard className="p-5">
                <p className="text-sm text-neutral-500">Sign in to join focus rooms with voice and video.</p>
            </GlassCard>
        );
    }

    if (room && roomId) {
        return (
            <div className="rounded-2xl overflow-hidden border border-white/8 bg-[#111114] shadow-2xl">
                <div className="px-4 py-3 border-b border-white/8 bg-[#16161a] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Voice channel</p>
                        <h3 className="font-bold text-white text-sm truncate flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            {room.title}
                        </h3>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Timer</p>
                        <p className="text-2xl font-black text-sky-400 tabular-nums">{countdown}</p>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {rtc.participants.map((p) => (
                            <VideoTile
                                key={p.peerId}
                                stream={p.stream}
                                label={p.displayName}
                                isLocal={p.isLocal}
                            />
                        ))}
                        {rtc.participants.length === 0 && (
                            <div className="col-span-full py-8 text-center text-sm text-neutral-500">
                                Connecting voice…
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {room.members.slice(0, 8).map((m) => (
                            <div
                                key={m.username}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/5"
                                title={m.displayName}
                            >
                                {m.avatarUrl ? (
                                    <img src={m.avatarUrl} alt="" className={`${PROFILE_AVATAR_IMG_CLASS} !w-5 !h-5`} />
                                ) : (
                                    <div className={`${PROFILE_AVATAR_FALLBACK_CLASS} !w-5 !h-5 !text-[10px]`}>
                                        {m.displayName.charAt(0)}
                                    </div>
                                )}
                                <span className="text-[10px] text-neutral-400 truncate max-w-[80px]">
                                    {m.displayName.split(' ')[0]}
                                </span>
                            </div>
                        ))}
                        <span className="text-[10px] text-neutral-600 self-center ml-1">
                            {room.participantCount} in room
                        </span>
                    </div>

                    {rtc.rtcError && <p className="text-xs text-amber-400">{rtc.rtcError}</p>}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/6">
                        <button
                            type="button"
                            onClick={rtc.toggleMic}
                            className={`p-3 rounded-full ${rtc.micOn ? 'bg-white/10 text-white' : 'bg-red-500/20 text-red-400'}`}
                            title={rtc.micOn ? 'Mute' : 'Unmute'}
                        >
                            {rtc.micOn ? <Mic size={18} /> : <MicOff size={18} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => void rtc.toggleCam()}
                            className={`p-3 rounded-full ${rtc.camOn ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-500'}`}
                            title={rtc.camOn ? 'Turn off camera' : 'Turn on camera'}
                        >
                            {rtc.camOn ? <Video size={18} /> : <VideoOff size={18} />}
                        </button>
                        <button
                            type="button"
                            onClick={copyLink}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-xs font-bold text-sky-300"
                        >
                            <Copy size={12} />
                            {copied ? 'Copied!' : 'Copy focuznow.com link'}
                        </button>
                        <a
                            href={shareUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-neutral-300"
                        >
                            <ExternalLink size={12} />
                            Open on web
                        </a>
                        <button
                            type="button"
                            onClick={() => void handleLeave()}
                            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-xs font-bold text-red-400"
                        >
                            <DoorOpen size={12} />
                            Leave
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <GlassCard className="p-5 sm:p-6">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-1">
                <Users size={16} className="text-sky-400" />
                Start a Focus Room
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
                Discord-style voice + video co-focus. Share a{' '}
                <span className="text-sky-400 font-medium">focuznow.com/room/…</span> link.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Create</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-sky-500/50"
                        placeholder="Room title"
                    />
                    <input
                        type="number"
                        min={5}
                        max={180}
                        value={durationMin}
                        onChange={(e) => setDurationMin(Number(e.target.value) || 25)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-sky-500/50"
                    />
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleCreate()}
                        className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-bold"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Start room'}
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Join</label>
                    <input
                        value={joinInput}
                        onChange={(e) => setJoinInput(e.target.value)}
                        placeholder="Room ID"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-sky-500/50 font-mono text-xs"
                    />
                    <button
                        type="button"
                        disabled={loading || !joinInput.trim()}
                        onClick={() => void handleJoin()}
                        className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white text-sm font-bold"
                    >
                        Join room
                    </button>
                </div>
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
        </GlassCard>
    );
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import {
    ArrowLeft,
    Check,
    ChevronUp,
    Copy,
    DoorOpen,
    Download,
    Loader2,
    MessageSquare,
    Mic,
    MicOff,
    MoreVertical,
    Paperclip,
    Plus,
    Shield,
    Sparkles,
    Users,
    Video,
    VideoOff,
    Trash2,
    Volume2,
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
import { FREE_FOCUS_ROOM_MAX_MIN, PRO_FOCUS_ROOM_MAX_MIN, useFocusRoomRtc } from '../lib/focusRoomRtc';
import {
    deleteAttachment,
    downloadAttachment,
    uploadAttachment,
    type AttachmentRecord,
} from '../lib/attachmentApi';
import { avatarGradientColors, getInitials } from '../lib/avatarInitials';

function formatCountdown(endsAt: string): string {
    const sec = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** Strip the local " (you)" suffix so avatar seeds/initials stay stable for a given person. */
function baseNameFor(label: string): string {
    return label.replace(/\s*\(you\)\s*$/i, '').trim() || label;
}

function ParticipantAvatar({ seed, avatarUrl, size = 80 }: { seed: string; avatarUrl?: string | null; size?: number }) {
    const colors = useMemo(() => avatarGradientColors(seed), [seed]);
    return (
        <div className="absolute inset-0">
            <MeshGradient
                colors={colors}
                speed={0.22}
                distortion={0.55}
                swirl={0.3}
                style={{ width: '100%', height: '100%' }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt=""
                        className="rounded-full object-cover border-2 border-white/25 shadow-lg"
                        style={{ width: size, height: size }}
                    />
                ) : (
                    <div
                        className="rounded-full flex items-center justify-center font-semibold text-white bg-white/10 backdrop-blur-md border-2 border-white/25 shadow-lg"
                        style={{ width: size, height: size, fontSize: size * 0.32 }}
                    >
                        {getInitials(seed)}
                    </div>
                )}
            </div>
        </div>
    );
}

function ParticipantTile({
    stream,
    label,
    avatarUrl,
    isLocal,
    camOn,
    speakerId,
    speaking,
    micOn,
    mutedByHost,
}: {
    stream: MediaStream | null;
    label: string;
    avatarUrl?: string | null;
    isLocal?: boolean;
    camOn: boolean;
    speakerId?: string;
    speaking?: boolean;
    micOn?: boolean;
    mutedByHost?: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const hasVideo = camOn && (stream?.getVideoTracks().some((t) => t.enabled) ?? false);
    const showMutedBadge = mutedByHost || micOn === false;

    useEffect(() => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!stream) {
            if (video) video.srcObject = null;
            if (audio) audio.srcObject = null;
            return;
        }
        if (video) video.srcObject = hasVideo ? stream : null;
        if (audio && !isLocal) {
            audio.srcObject = stream;
            if (speakerId && 'setSinkId' in audio) {
                void (audio as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> })
                    .setSinkId(speakerId)
                    .catch(() => {});
            }
            void audio.play().catch(() => {});
        }
    }, [stream, hasVideo, isLocal, speakerId]);

    return (
        <div
            className={`group relative aspect-video rounded-2xl overflow-hidden bg-[#121214] border transition-colors duration-200 ${
                speaking ? 'border-emerald-400/60 shadow-[0_0_0_3px_rgba(52,211,153,0.14)]' : 'border-white/[0.08] hover:border-white/[0.14]'
            }`}
        >
            {!isLocal && <audio ref={audioRef} autoPlay playsInline className="sr-only" />}
            {hasVideo ? (
                <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
            ) : (
                <ParticipantAvatar seed={baseNameFor(label)} avatarUrl={avatarUrl} />
            )}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate px-2 py-1 rounded-lg bg-black/55 backdrop-blur-sm text-xs font-semibold text-[#dbdee1]">
                    {label}
                </span>
                {showMutedBadge && (
                    <span
                        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-black/55 backdrop-blur-sm text-red-400"
                        aria-label="Muted"
                    >
                        <MicOff size={12} />
                    </span>
                )}
            </div>
        </div>
    );
}

/** Discord-style control with corner chevron that opens a device picker. */
function DeviceToggleButton({
    active,
    onToggle,
    icon,
    offIcon,
    label,
    menuTitle,
    sections,
    open,
    onOpenChange,
}: {
    active: boolean;
    onToggle: () => void;
    icon: ReactNode;
    offIcon: ReactNode;
    label: string;
    menuTitle: string;
    sections: { heading: string; devices: MediaDeviceInfo[]; selectedId: string; onSelect: (id: string) => void; emptyLabel: string }[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, onOpenChange]);

    return (
        <div ref={rootRef} className="relative flex items-stretch">
            <button
                type="button"
                onClick={onToggle}
                aria-label={label}
                className={`w-12 h-12 rounded-l-full flex items-center justify-center transition-colors ${
                    active ? 'bg-[#35373c] hover:bg-[#404249]' : 'bg-red-500/30 hover:bg-red-500/40'
                }`}
            >
                {active ? icon : offIcon}
            </button>
            <button
                type="button"
                aria-label={`${menuTitle} options`}
                aria-expanded={open}
                onClick={() => onOpenChange(!open)}
                className={`w-5 h-12 rounded-r-full flex items-center justify-center border-l border-black/30 transition-colors ${
                    active ? 'bg-[#35373c] hover:bg-[#404249]' : 'bg-red-500/30 hover:bg-red-500/40'
                }`}
            >
                <ChevronUp size={12} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
            </button>
            {open && (
                <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-64 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#111214]/backdrop-blur-xl shadow-2xl shadow-black/50 z-50 py-1.5">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">{menuTitle}</p>
                    {sections.map((section) => (
                        <div key={section.heading} className="mb-1">
                            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#6d6f78]">
                                {section.heading}
                            </p>
                            {section.devices.length === 0 ? (
                                <p className="px-3 py-1.5 text-xs text-[#6d6f78]">{section.emptyLabel}</p>
                            ) : (
                                section.devices.map((d) => {
                                    const selected = d.deviceId === section.selectedId || (!section.selectedId && section.devices[0]?.deviceId === d.deviceId);
                                    return (
                                        <button
                                            key={d.deviceId}
                                            type="button"
                                            onClick={() => {
                                                section.onSelect(d.deviceId);
                                                onOpenChange(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-[#dbdee1] hover:bg-white/[0.06]"
                                        >
                                            <span className="w-4 shrink-0 text-emerald-400">
                                                {selected ? <Check size={12} /> : null}
                                            </span>
                                            <span className="truncate">{d.label || section.heading}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

type Props = {
    onBack?: () => void;
    embedded?: boolean;
};

export default function FocusRoomView({ onBack, embedded = false }: Props) {
    const { session, engineState, subscriptionTier, upgradeToPro } = useAuthStore();
    const isPro = subscriptionTier === 'pro';
    const maxDurationMin = isPro ? PRO_FOCUS_ROOM_MAX_MIN : FREE_FOCUS_ROOM_MAX_MIN;
    const [roomId, setRoomId] = useState<string | null>(null);
    const [room, setRoom] = useState<FocusRoom | null>(null);
    const [title, setTitle] = useState('Focus Room');
    const [durationMin, setDurationMin] = useState(FREE_FOCUS_ROOM_MAX_MIN);
    const [joinInput, setJoinInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState('');
    const [copied, setCopied] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [hostOpen, setHostOpen] = useState(false);
    const [micMenuOpen, setMicMenuOpen] = useState(false);
    const [camMenuOpen, setCamMenuOpen] = useState(false);
    const [chatDraft, setChatDraft] = useState('');
    const [inRoom, setInRoom] = useState(false);
    const [joinPrefs, setJoinPrefs] = useState({
        micId: '',
        speakerId: '',
        cameraId: '',
        noiseSuppression: true,
        echoCancellation: true,
    });
    const [testTonePlaying, setTestTonePlaying] = useState(false);
    const [attachmentError, setAttachmentError] = useState('');
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const chatFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setDurationMin((prev) => Math.min(Math.max(5, prev), maxDurationMin));
    }, [maxDurationMin]);

    const displayName =
        engineState.profileName?.trim() ||
        session?.user?.user_metadata?.full_name ||
        session?.user?.email?.split('@')[0] ||
        'Focus';

    const tokens =
        session?.access_token && session?.refresh_token
            ? { access_token: session.access_token, refresh_token: session.refresh_token }
            : null;

    const isHost = !!room && !!session?.user?.id && room.hostId === session.user.id;

    const rtc = useFocusRoomRtc(
        supabase,
        inRoom ? roomId : null,
        displayName,
        inRoom && !!(room && roomId),
        isHost,
        joinPrefs,
        engineState.profileAvatar,
    );

    const uploadRoomAttachment = async (file: File) => {
        if (!roomId || uploadingAttachment) return;
        if (subscriptionTier !== 'pro') {
            setAttachmentError('Chat attachments are available on Pro.');
            return;
        }
        setUploadingAttachment(true);
        setAttachmentError('');
        const result = await uploadAttachment(supabase, file, { context: 'room', roomId });
        setUploadingAttachment(false);
        if (!result.ok) {
            setAttachmentError(result.error);
            return;
        }
        rtc.sendChat('', { ...result.attachment, extractedText: null });
    };

    const removeRoomAttachment = async (attachment: AttachmentRecord) => {
        const result = await deleteAttachment(supabase, attachment);
        if (!result.ok) {
            setAttachmentError(result.error);
            return;
        }
        rtc.removeChatAttachment(attachment.id);
    };

    useEffect(() => {
        const el = previewVideoRef.current;
        if (!el || inRoom) return;
        el.srcObject = rtc.camOn && rtc.localStream ? rtc.localStream : null;
    }, [rtc.localStream, rtc.camOn, inRoom]);

    const pollRoom = useCallback(async (id: string) => {
        const res = await getFocusRoom(supabase, id);
        if (res.ok && res.room) {
            setRoom(res.room);
            setCountdown(formatCountdown(res.room.endsAt));
        } else {
            setRoom(null);
            setRoomId(null);
            setInRoom(false);
            await chrome.storage.local.remove(FOCUS_ROOM_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        void chrome.storage.local.get(FOCUS_ROOM_STORAGE_KEY).then((r) => {
            const id = r[FOCUS_ROOM_STORAGE_KEY] as string | undefined;
            if (id) {
                setRoomId(id);
                setInRoom(true);
            }
        });
    }, []);

    useEffect(() => {
        if (!roomId || !inRoom) return;
        const initialPoll = window.setTimeout(() => void pollRoom(roomId), 0);
        const poll = window.setInterval(() => void pollRoom(roomId), 5000);
        const tick = window.setInterval(() => {
            if (room?.endsAt) setCountdown(formatCountdown(room.endsAt));
        }, 1000);
        return () => {
            window.clearTimeout(initialPoll);
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [roomId, room?.endsAt, pollRoom, inRoom]);

    const handleCreate = async () => {
        if (!session) return;
        const clamped = Math.min(Math.max(5, durationMin), maxDurationMin);
        setDurationMin(clamped);
        setLoading(true);
        const res = await createFocusRoom(supabase, title, clamped, tokens);
        setLoading(false);
        if (res.ok && res.roomId) {
            setRoomId(res.roomId);
            setInRoom(true);
            await chrome.storage.local.set({ [FOCUS_ROOM_STORAGE_KEY]: res.roomId });
            void pollRoom(res.roomId);
        } else setError(res.error ?? 'Could not create room');
    };

    const handleJoinRoom = async (id?: string) => {
        const rid = (id ?? joinInput).trim();
        if (!rid || !session) return;
        setLoading(true);
        const res = await joinFocusRoom(supabase, rid, tokens);
        setLoading(false);
        if (res.ok) {
            setRoomId(rid);
            setInRoom(true);
            await chrome.storage.local.set({ [FOCUS_ROOM_STORAGE_KEY]: rid });
            void pollRoom(rid);
        } else setError(res.error ?? 'Join failed');
    };

    const handleLeave = async () => {
        if (roomId) await leaveFocusRoom(supabase, roomId, tokens);
        setRoom(null);
        setRoomId(null);
        setInRoom(false);
        await chrome.storage.local.remove(FOCUS_ROOM_STORAGE_KEY);
        onBack?.();
    };

    const playTestTone = async () => {
        try {
            const ctx = new AudioContext();
            await ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 440;
            gain.gain.value = 0.08;
            osc.connect(gain);
            if (rtc.selectedSpeakerId && 'setSinkId' in ctx) {
                const dest = ctx.createMediaStreamDestination();
                gain.connect(dest);
                const audio = new Audio();
                audio.srcObject = dest.stream;
                await (audio as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> })
                    .setSinkId(rtc.selectedSpeakerId);
                await audio.play();
            } else {
                gain.connect(ctx.destination);
            }
            osc.start();
            setTestTonePlaying(true);
            window.setTimeout(() => {
                osc.stop();
                void ctx.close();
                setTestTonePlaying(false);
            }, 600);
        } catch {
            setError('Could not play test tone');
        }
    };

    const shareUrl = roomId ? focusRoomUrl(roomId) : '';

    if (!session) {
        return (
            <div className={`${embedded ? 'h-full' : 'h-screen'} flex items-center justify-center bg-[#0a0a0b] text-neutral-200 p-6`}>
                <div className="max-w-md text-center space-y-4">
                    <Users size={40} className="mx-auto text-neutral-500" />
                    <h1 className="text-2xl font-bold text-white">Focuz Rooms</h1>
                    <p className="text-sm text-[#949ba4]">Sign in to join voice focus sessions with friends.</p>
                    <button
                        type="button"
                        onClick={() => window.open('https://focuznow.com/signup', '_blank')}
                        className="px-5 py-2 rounded-md bg-neutral-100 hover:bg-white font-medium text-neutral-950"
                    >
                        Create Account
                    </button>
                </div>
            </div>
        );
    }

    if (!inRoom || !room || !roomId) {
        return (
            <div
                className={`${embedded ? 'h-full' : 'h-screen'} relative bg-[#070708] text-neutral-200 flex flex-col overflow-hidden`}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-80"
                    style={{
                        background:
                            'radial-gradient(ellipse 80% 50% at 20% 20%, rgba(88,101,242,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 85% 70%, rgba(16,185,129,0.08), transparent 50%)',
                    }}
                />
                {onBack && !embedded && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="relative z-10 m-4 flex items-center gap-2 text-sm text-[#949ba4] hover:text-white w-fit"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                )}
                <div className="relative z-10 flex-1 grid lg:grid-cols-[1.05fr_0.95fr] gap-0 min-h-0 overflow-y-auto lg:overflow-hidden">
                    <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12 lg:pr-8">
                        <div className="relative aspect-video max-h-[440px] rounded-3xl overflow-hidden border border-white/[0.1] bg-white/[0.03] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
                            <video
                                ref={previewVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${rtc.camOn ? '' : 'hidden'}`}
                            />
                            {!rtc.camOn && (
                                <>
                                    <ParticipantAvatar seed={displayName} avatarUrl={engineState.profileAvatar} size={96} />
                                    <p className="absolute inset-x-0 bottom-16 text-center text-sm font-medium text-white/70">
                                        Camera off
                                    </p>
                                </>
                            )}
                            <div className="absolute bottom-4 left-4 right-4">
                                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden backdrop-blur-sm">
                                    <div
                                        className="h-full bg-emerald-400 transition-all duration-75"
                                        style={{ width: `${Math.round(rtc.micLevel * 100)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-[#949ba4] mt-1.5 uppercase tracking-wider font-semibold">
                                    Mic level ·{' '}
                                    {rtc.permissionState === 'granted'
                                        ? 'Ready'
                                        : rtc.permissionState === 'denied'
                                          ? 'Blocked'
                                          : 'Waiting'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button
                                type="button"
                                onClick={() => void rtc.toggleCam()}
                                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm font-semibold flex items-center justify-center gap-2 backdrop-blur-md"
                            >
                                {rtc.camOn ? <Video size={16} /> : <VideoOff size={16} />}
                                {rtc.camOn ? 'Camera on' : 'Camera off'}
                            </button>
                            <button
                                type="button"
                                onClick={rtc.toggleMic}
                                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm font-semibold flex items-center justify-center gap-2 backdrop-blur-md"
                            >
                                {rtc.micOn ? <Mic size={16} /> : <MicOff size={16} />}
                                {rtc.micOn ? 'Mic on' : 'Mic off'}
                            </button>
                            <button
                                type="button"
                                onClick={() => void playTestTone()}
                                className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm font-semibold flex items-center gap-2 backdrop-blur-md"
                            >
                                <Volume2 size={16} />
                                {testTonePlaying ? '…' : 'Test'}
                            </button>
                        </div>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className="block rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 backdrop-blur-md">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#949ba4]">Camera</span>
                                <select
                                    value={joinPrefs.cameraId || rtc.selectedCameraId}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setJoinPrefs((p) => ({ ...p, cameraId: id }));
                                        void rtc.selectCamera(id);
                                    }}
                                    className="mt-1 w-full bg-transparent text-sm outline-none"
                                >
                                    <option value="">Default</option>
                                    {rtc.videoInputs.map((d) => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 backdrop-blur-md">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#949ba4]">Microphone</span>
                                <select
                                    value={joinPrefs.micId || rtc.selectedMicId}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setJoinPrefs((p) => ({ ...p, micId: id }));
                                        void rtc.selectMic(id);
                                    }}
                                    className="mt-1 w-full bg-transparent text-sm outline-none"
                                >
                                    <option value="">Default</option>
                                    {rtc.audioInputs.map((d) => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 backdrop-blur-md">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#949ba4]">Speaker</span>
                                <select
                                    value={joinPrefs.speakerId || rtc.selectedSpeakerId}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setJoinPrefs((p) => ({ ...p, speakerId: id }));
                                        rtc.selectSpeaker(id);
                                    }}
                                    className="mt-1 w-full bg-transparent text-sm outline-none"
                                >
                                    <option value="">Default</option>
                                    {rtc.audioOutputs.map((d) => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-[#b5bac1]">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={joinPrefs.noiseSuppression}
                                    onChange={(e) => setJoinPrefs((p) => ({ ...p, noiseSuppression: e.target.checked }))}
                                    className="rounded"
                                />
                                Noise suppression
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={joinPrefs.echoCancellation}
                                    onChange={(e) => setJoinPrefs((p) => ({ ...p, echoCancellation: e.target.checked }))}
                                    className="rounded"
                                />
                                Echo cancellation
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12 lg:pl-4 lg:overflow-y-auto">
                        <div className="rounded-3xl border border-white/[0.1] bg-white/[0.04] p-6 sm:p-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400/90">Focuz Rooms</p>
                            <h1 className="mt-2 text-3xl font-bold text-white tracking-tight">Join a focus room</h1>
                            <p className="mt-2 text-sm text-[#949ba4] leading-relaxed">
                                Create a timed co-focus session or enter a room code to join friends.
                            </p>

                            <div className="mt-7 space-y-5">
                                <section className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center">
                                            <Plus size={16} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-white">Create a room</h2>
                                            <p className="text-[11px] text-[#949ba4]">You&apos;ll be the host</p>
                                        </div>
                                    </div>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Room name"
                                        className="w-full bg-[#121214]/80 border border-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:border-[#5865f2]/70"
                                    />
                                    <div className="mt-3 flex items-end gap-3">
                                        <label className="flex-1">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#949ba4]">
                                                Duration (min)
                                            </span>
                                            <input
                                                type="number"
                                                min={5}
                                                max={maxDurationMin}
                                                value={durationMin}
                                                onChange={(e) => {
                                                    const next = Number(e.target.value) || FREE_FOCUS_ROOM_MAX_MIN;
                                                    setDurationMin(Math.min(Math.max(5, next), maxDurationMin));
                                                }}
                                                className="mt-1.5 w-full bg-[#121214]/80 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#5865f2]/70"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => void handleCreate()}
                                            className="shrink-0 px-5 py-3 rounded-xl bg-neutral-100 hover:bg-white font-semibold text-neutral-950 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                                            Create room
                                        </button>
                                    </div>
                                    {!isPro ? (
                                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5">
                                            <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-300" />
                                            <p className="text-xs text-amber-100/90 leading-relaxed">
                                                Free plan rooms last up to <strong>{FREE_FOCUS_ROOM_MAX_MIN} minutes</strong>.
                                                Upgrade to Pro for sessions up to {PRO_FOCUS_ROOM_MAX_MIN} minutes.
                                                <button
                                                    type="button"
                                                    onClick={() => void upgradeToPro()}
                                                    className="ml-1 font-bold underline underline-offset-2"
                                                >
                                                    Upgrade
                                                </button>
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-[11px] text-[#6d6f78]">
                                            Pro · up to {PRO_FOCUS_ROOM_MAX_MIN} minutes per room
                                        </p>
                                    )}
                                </section>

                                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#6d6f78]">
                                    <span className="flex-1 h-px bg-white/[0.08]" />
                                    or
                                    <span className="flex-1 h-px bg-white/[0.08]" />
                                </div>

                                <section className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center">
                                            <Users size={16} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-white">Join with code</h2>
                                            <p className="text-[11px] text-[#949ba4]">Paste a room ID from an invite</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={joinInput}
                                            onChange={(e) => setJoinInput(e.target.value)}
                                            placeholder="Room code"
                                            className="flex-1 min-w-0 bg-[#121214]/80 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-[#5865f2]/70 tracking-wide"
                                        />
                                        <button
                                            type="button"
                                            disabled={loading || !joinInput.trim()}
                                            onClick={() => void handleJoinRoom()}
                                            className="px-5 py-3 rounded-xl bg-[#35373c] hover:bg-[#404249] font-semibold disabled:opacity-40"
                                        >
                                            Join
                                        </button>
                                    </div>
                                </section>
                            </div>

                            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
                            {rtc.rtcError && <p className="text-amber-400 text-sm mt-2">{rtc.rtcError}</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${embedded ? 'h-full' : 'h-screen'} flex flex-col bg-[#0a0a0b] text-neutral-200 overflow-hidden`}>
            <header className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {onBack && !embedded && (
                        <button type="button" onClick={onBack} className="text-[#949ba4] hover:text-white">
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-white truncate">{room.title}</span>
                    <span className="text-xs text-[#949ba4]">{room.participantCount} in room</span>
                    {rtc.roomLocked && <Shield size={14} className="text-amber-400" aria-label="Room locked" />}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-neutral-300 tabular-nums">{countdown}</span>
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
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                        {rtc.participants.map((p) => (
                            <ParticipantTile
                                key={p.peerId}
                                stream={p.stream}
                                label={p.displayName}
                                avatarUrl={p.avatarUrl}
                                isLocal={p.isLocal}
                                camOn={p.isLocal ? rtc.camOn : !!p.stream?.getVideoTracks().some((t) => t.enabled)}
                                speakerId={rtc.selectedSpeakerId}
                                speaking={p.speaking}
                                micOn={p.isLocal ? rtc.micOn : undefined}
                                mutedByHost={p.mutedByHost}
                            />
                        ))}
                    </div>
                </div>

                {chatOpen && (
                    <aside
                        className="w-72 my-3 mr-3 rounded-2xl border border-[#2b2d31] bg-[#18181b] shadow-xl shadow-black/30 flex flex-col shrink-0 overflow-hidden"
                        onDragOver={(event) => {
                            if (event.dataTransfer.types.includes('Files')) event.preventDefault();
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            const file = event.dataTransfer.files[0];
                            if (file) void uploadRoomAttachment(file);
                        }}
                    >
                        <div className="h-12 px-3 flex items-center justify-between border-b border-[#2b2d31]">
                            <span className="font-bold text-sm">Chat</span>
                            <button type="button" onClick={() => setChatOpen(false)}><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
                            {rtc.chat.map((m) => (
                                <div key={m.id}>
                                    <span className="font-medium text-neutral-400 text-xs">{m.name}</span>
                                    {m.text && <p className="text-[#dbdee1] break-words">{m.text}</p>}
                                    {m.attachment && (
                                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 p-2">
                                            <Paperclip size={13} className="shrink-0 text-neutral-500" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs text-neutral-300">{m.attachment.fileName}</p>
                                                <p className="text-[9px] text-neutral-600">
                                                    {(m.attachment.sizeBytes / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void downloadAttachment(supabase, m.attachment!).then((result) => {
                                                    if (!result.ok) setAttachmentError(result.error);
                                                })}
                                                aria-label={`Download ${m.attachment.fileName}`}
                                            >
                                                <Download size={13} />
                                            </button>
                                            {m.attachment.ownerId === session.user.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => void removeRoomAttachment(m.attachment!)}
                                                    className="text-red-400"
                                                    aria-label={`Delete ${m.attachment.fileName}`}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <input
                            ref={chatFileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadRoomAttachment(file);
                                event.target.value = '';
                            }}
                        />
                        {attachmentError && (
                            <div className="mx-3 mb-2 rounded-lg bg-amber-400/10 p-2 text-[10px] text-amber-200">
                                {attachmentError}
                                {subscriptionTier !== 'pro' && (
                                    <button type="button" onClick={() => void upgradeToPro()} className="ml-2 font-bold underline">
                                        Upgrade
                                    </button>
                                )}
                            </div>
                        )}
                        <form
                            className="p-3 border-t border-[#2b2d31] flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                rtc.sendChat(chatDraft);
                                setChatDraft('');
                            }}
                        >
                            <button
                                type="button"
                                disabled={uploadingAttachment}
                                onClick={() => {
                                    if (subscriptionTier === 'pro') chatFileInputRef.current?.click();
                                    else setAttachmentError('Chat attachments are available on Pro.');
                                }}
                                className="rounded-lg bg-[#111214] p-2 text-neutral-400 hover:text-white disabled:opacity-40"
                                aria-label="Attach file"
                            >
                                {uploadingAttachment ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                            </button>
                            <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Message…" className="min-w-0 flex-1 bg-[#111214] rounded-lg px-3 py-2 text-sm outline-none border border-[#2b2d31]" />
                        </form>
                    </aside>
                )}
            </main>

            <footer className="h-[72px] px-4 flex items-center justify-center gap-2 bg-[#1e1f22] border-t border-[#111214] shrink-0 relative">
                <DeviceToggleButton
                    active={rtc.micOn}
                    onToggle={rtc.toggleMic}
                    icon={<Mic size={20} />}
                    offIcon={<MicOff size={20} className="text-red-400" />}
                    label={rtc.micOn ? 'Mute microphone' : 'Unmute microphone'}
                    menuTitle="Audio devices"
                    open={micMenuOpen}
                    onOpenChange={(open) => {
                        setMicMenuOpen(open);
                        if (open) setCamMenuOpen(false);
                    }}
                    sections={[
                        {
                            heading: 'Microphone',
                            devices: rtc.audioInputs,
                            selectedId: rtc.selectedMicId,
                            onSelect: (id) => {
                                setJoinPrefs((p) => ({ ...p, micId: id }));
                                void rtc.selectMic(id);
                            },
                            emptyLabel: 'No microphones found',
                        },
                        {
                            heading: 'Speaker',
                            devices: rtc.audioOutputs,
                            selectedId: rtc.selectedSpeakerId,
                            onSelect: (id) => {
                                setJoinPrefs((p) => ({ ...p, speakerId: id }));
                                rtc.selectSpeaker(id);
                            },
                            emptyLabel: 'No speakers found',
                        },
                    ]}
                />
                <DeviceToggleButton
                    active={rtc.camOn}
                    onToggle={() => void rtc.toggleCam()}
                    icon={<Video size={20} />}
                    offIcon={<VideoOff size={20} className="text-red-400" />}
                    label={rtc.camOn ? 'Turn off camera' : 'Turn on camera'}
                    menuTitle="Video devices"
                    open={camMenuOpen}
                    onOpenChange={(open) => {
                        setCamMenuOpen(open);
                        if (open) setMicMenuOpen(false);
                    }}
                    sections={[
                        {
                            heading: 'Camera',
                            devices: rtc.videoInputs,
                            selectedId: rtc.selectedCameraId,
                            onSelect: (id) => {
                                setJoinPrefs((p) => ({ ...p, cameraId: id }));
                                void rtc.selectCamera(id);
                            },
                            emptyLabel: 'No cameras found',
                        },
                    ]}
                />
                <button type="button" onClick={() => setChatOpen((o) => !o)} className="w-12 h-12 rounded-full bg-[#35373c] hover:bg-[#404249] flex items-center justify-center">
                    <MessageSquare size={20} />
                </button>
                {isHost && (
                    <div className="relative">
                        <button type="button" onClick={() => setHostOpen((o) => !o)} className="w-12 h-12 rounded-full bg-[#35373c] hover:bg-[#404249] flex items-center justify-center">
                            <MoreVertical size={20} />
                        </button>
                        {hostOpen && (
                            <div className="absolute bottom-14 right-0 w-52 bg-[#111214] border border-[#2b2d31] rounded-xl shadow-xl p-1 z-50">
                                <p className="text-[10px] font-bold uppercase text-[#949ba4] px-2 py-1">Host controls</p>
                                {rtc.participants.filter((p) => !p.isLocal).map((p) => (
                                    <div key={p.peerId} className="flex gap-1 px-1">
                                        <button type="button" onClick={() => { rtc.mutePeer(p.peerId); setHostOpen(false); }} className="flex-1 text-left px-2 py-1.5 rounded text-xs hover:bg-[#35373c]">
                                            Mute {p.displayName.slice(0, 12)}
                                        </button>
                                        <button type="button" onClick={() => { rtc.kickPeer(p.peerId); setHostOpen(false); }} className="px-2 py-1.5 rounded text-xs text-red-400 hover:bg-[#35373c]">
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => { rtc.setRoomLock(!rtc.roomLocked); setHostOpen(false); }} className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-[#35373c] flex items-center gap-2">
                                    <Shield size={12} /> {rtc.roomLocked ? 'Unlock room' : 'Lock room'}
                                </button>
                                <button type="button" onClick={() => { rtc.endSession(); void handleLeave(); }} className="w-full text-left px-2 py-1.5 rounded text-xs text-red-400 hover:bg-[#35373c]">
                                    End session for all
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <button type="button" onClick={() => void handleLeave()} className="ml-3 px-4 h-10 rounded-lg bg-red-500 hover:bg-red-600 font-bold text-white flex items-center gap-2">
                    <DoorOpen size={16} /> Leave
                </button>
            </footer>
            {rtc.rtcError && <p className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-amber-400 bg-black/70 px-3 py-1 rounded-lg">{rtc.rtcError}</p>}
        </div>
    );
}

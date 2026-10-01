import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AlertCircle, Download, ExternalLink, Loader2, Pause, Play } from 'lucide-react';
import { IconButton } from '../../components/fz/IconButton';

const BARS = 64;
const SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const;
const PLAY_EVENT = 'fz-audio-play';
type Waveform = { peaks: number[]; seconds: number };
/** Decoded waveforms, keyed by a stable id (storage path or link), so re-renders and re-opens are free. */
const waveCache = new Map<string, Waveform | null>();

/** "DS_VCD_105_loop_Fmin.wav?ex=…" → { title: "DS VCD 105 loop Fmin", ext: "WAV" }. */
export function audioName(fileNameOrUrl: string): { title: string; ext: string } {
    let raw = fileNameOrUrl;
    try {
        raw = new URL(fileNameOrUrl).pathname.split('/').pop() || raw;
    } catch {
        raw = raw.split(/[?#]/)[0].split('/').pop() || raw;
    }
    try {
        raw = decodeURIComponent(raw);
    } catch {
        /* keep it encoded */
    }
    const match = raw.match(/^(.*)\.([a-z0-9]{2,5})$/i);
    const title = (match ? match[1] : raw).replace(/_+/g, ' ').trim();
    return { title: title || 'Audio', ext: match ? match[2].toUpperCase() : '' };
}

function formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function formatBytes(n: number) {
    return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Loudness per bar (0–1) and length. Null when the file can't be read (another site without CORS, say). */
async function loadWaveform(src: string): Promise<Waveform | null> {
    const res = await fetch(src);
    if (!res.ok) return null;
    const decoder = new OfflineAudioContext(1, 1, 44100);
    const audio = await decoder.decodeAudioData(await res.arrayBuffer());
    const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
    const size = Math.max(1, Math.floor(audio.length / BARS));
    const peaks: number[] = [];
    for (let b = 0; b < BARS; b++) {
        let sum = 0;
        let count = 0;
        // Sample the window rather than every frame: plenty for 64 bars, fast on long files.
        const stride = Math.max(1, Math.floor(size / 400));
        for (let i = b * size; i < Math.min(audio.length, (b + 1) * size); i += stride) {
            let v = 0;
            for (const ch of channels) v += Math.abs(ch[i]);
            sum += (v / channels.length) ** 2;
            count++;
        }
        peaks.push(count ? Math.sqrt(sum / count) : 0);
    }
    const max = Math.max(...peaks, 1e-6);
    return { peaks: peaks.map((p) => Math.max(0.08, (p / max) ** 0.8)), seconds: audio.duration };
}

type Props = {
    /** Playable address: a link, or a signed URL for an uploaded file ('' while it's being fetched). */
    src: string;
    /** Stable id for the waveform cache (the upload's storage path, or the link). */
    cacheKey: string;
    /** File name or link the title comes from. */
    name: string;
    sizeBytes?: number;
    onDownload?: () => void;
    /** Link audio: offer "open in a new tab" instead of a download. */
    href?: string;
};

export function AudioPlayer({ src, cacheKey, name, sizeBytes, onDownload, href }: Props) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const playerId = useId();
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [mediaDuration, setMediaDuration] = useState(0);
    const [speed, setSpeed] = useState(0);
    const [failed, setFailed] = useState(false);
    const [wave, setWave] = useState<Waveform | null | undefined>(() => waveCache.get(cacheKey));
    const { title, ext } = audioName(name);
    const peaks = wave?.peaks;
    // Some servers (no byte ranges) report an infinite length; the decoded file knows better.
    const duration = mediaDuration || wave?.seconds || 0;
    const readDuration = (d: number) => setMediaDuration(Number.isFinite(d) && d > 0 ? d : 0);
    const progress = duration ? Math.min(1, current / duration) : 0;

    // Waveform: decode once per file, when the browser has a moment.
    useEffect(() => {
        if (!src || waveCache.has(cacheKey)) {
            setWave(waveCache.get(cacheKey));
            return;
        }
        let alive = true;
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
        const cancel = window.cancelIdleCallback ?? window.clearTimeout;
        const handle = idle(() => {
            loadWaveform(src)
                .catch(() => null)
                .then((result) => {
                    waveCache.set(cacheKey, result);
                    if (alive) setWave(result);
                });
        });
        return () => {
            alive = false;
            cancel(handle);
        };
    }, [src, cacheKey]);

    // Smooth progress while playing; timeupdate alone only fires ~4 times a second.
    useEffect(() => {
        if (!playing) return;
        let frame = 0;
        const tick = () => {
            if (audioRef.current) setCurrent(audioRef.current.currentTime);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing]);

    // One clip at a time across the page.
    useEffect(() => {
        const onOther = (e: Event) => {
            if ((e as CustomEvent<string>).detail !== playerId) audioRef.current?.pause();
        };
        window.addEventListener(PLAY_EVENT, onOther);
        return () => window.removeEventListener(PLAY_EVENT, onOther);
    }, [playerId]);

    const toggle = () => {
        const el = audioRef.current;
        if (!el || failed) return;
        if (el.paused) {
            window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: playerId }));
            // A refused play() (autoplay rules, interrupted by a pause) isn't a broken file: onError covers that.
            void el.play().catch(() => {});
        } else {
            el.pause();
        }
    };

    const seekTo = (seconds: number) => {
        const el = audioRef.current;
        if (!el || !duration || !Number.isFinite(seconds)) return;
        el.currentTime = Math.max(0, Math.min(duration, seconds));
        setCurrent(el.currentTime);
    };

    const seekFromPointer = (clientX: number) => {
        const r = trackRef.current?.getBoundingClientRect();
        if (!r || !r.width) return;
        seekTo(((clientX - r.left) / r.width) * duration);
    };

    const onTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        if (!duration) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromPointer(e.clientX);
    };

    const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 15 : 5;
        const actions: Record<string, () => void> = {
            ArrowRight: () => seekTo(current + step),
            ArrowUp: () => seekTo(current + step),
            ArrowLeft: () => seekTo(current - step),
            ArrowDown: () => seekTo(current - step),
            Home: () => seekTo(0),
            End: () => seekTo(duration),
            ' ': toggle,
            Enter: toggle,
        };
        const action = actions[e.key];
        if (!action) return;
        e.preventDefault();
        action();
    };

    const cycleSpeed = () => {
        const next = (speed + 1) % SPEEDS.length;
        setSpeed(next);
        if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
    };

    const meta = [ext, duration ? formatTime(duration) : null, sizeBytes ? formatBytes(sizeBytes) : null].filter(Boolean).join(' · ');

    return (
        <div className="rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 pb-3 pt-3">
            {src && (
                <audio
                    ref={audioRef}
                    src={src}
                    preload="metadata"
                    onLoadedMetadata={(e) => readDuration(e.currentTarget.duration)}
                    onDurationChange={(e) => readDuration(e.currentTarget.duration)}
                    onTimeUpdate={(e) => !playing && setCurrent(e.currentTarget.currentTime)}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onError={() => setFailed(true)}
                />
            )}

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={toggle}
                    disabled={!src || failed}
                    aria-label={playing ? `Pause ${title}` : `Play ${title}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--fz-text-1)] text-[var(--fz-bg-panel)] transition-[transform,opacity] duration-150 hover:scale-[1.04] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-focus-ring)] disabled:opacity-40 disabled:hover:scale-100"
                >
                    {!src ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : playing ? (
                        <Pause size={16} fill="currentColor" strokeWidth={0} />
                    ) : (
                        <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-px" />
                    )}
                </button>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--fz-text-1)]" title={title}>
                        {title}
                    </p>
                    <p className="text-[12px] text-[var(--fz-text-3)]">
                        {failed ? (
                            <span className="inline-flex items-center gap-1 text-[var(--fz-danger)]">
                                <AlertCircle size={12} />
                                Couldn't play this file
                            </span>
                        ) : (
                            meta || 'Audio'
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={cycleSpeed}
                    disabled={!src || failed}
                    aria-label={`Playback speed ${SPEEDS[speed]}×`}
                    className="h-7 min-w-[44px] rounded-md px-2 text-[12px] font-medium tabular-nums text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] disabled:opacity-40"
                >
                    {SPEEDS[speed]}×
                </button>
                {onDownload ? (
                    <IconButton icon={<Download size={14} />} tooltip={`Download ${title}`} onClick={onDownload} />
                ) : href ? (
                    <IconButton
                        icon={<ExternalLink size={14} />}
                        tooltip="Open in a new tab"
                        onClick={() => window.open(href, '_blank', 'noopener')}
                    />
                ) : null}
            </div>

            <div className="mt-2.5 flex items-center gap-3 pl-12">
                <div
                    ref={trackRef}
                    role="slider"
                    tabIndex={src && !failed ? 0 : -1}
                    aria-label={`Seek ${title}`}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    aria-valuenow={Math.round(current)}
                    aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
                    onPointerDown={onTrackPointerDown}
                    onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && seekFromPointer(e.clientX)}
                    onKeyDown={onTrackKey}
                    className="group/track relative h-8 min-w-0 flex-1 cursor-pointer touch-none rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-focus-ring)]"
                >
                    {peaks ? (
                        <div className="flex h-full items-center gap-[2px]">
                            {peaks.map((p, i) => (
                                <span
                                    key={i}
                                    className="flex-1 rounded-full transition-colors duration-100"
                                    style={{
                                        height: `${Math.round(p * 100)}%`,
                                        background: (i + 0.5) / peaks.length <= progress ? 'var(--fz-text-1)' : 'var(--fz-border-strong)',
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        // No waveform (still decoding, or a link we can't read): a plain track.
                        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--fz-border-strong)]">
                            <div className="h-full rounded-full bg-[var(--fz-text-1)]" style={{ width: `${progress * 100}%` }} />
                        </div>
                    )}
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--fz-text-3)]">
                    {formatTime(current)} / {formatTime(duration)}
                </span>
            </div>
        </div>
    );
}

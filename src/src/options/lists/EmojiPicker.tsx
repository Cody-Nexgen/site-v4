import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
    Apple,
    Check,
    Clock,
    FileText,
    Heart,
    Image as ImageIcon,
    Leaf,
    Lightbulb,
    Plane,
    Search,
    Shuffle,
    Smile,
    Trophy,
    Upload,
    type LucideIcon,
} from 'lucide-react';
import { Popover } from '../../components/fz/Popover';
import { ICONS, ICON_COLORS } from './editorUtils';
import {
    EMOJI_CATEGORIES,
    SKIN_TONES,
    searchEmoji,
    withSkinTone,
    type EmojiEntry,
} from '../../lib/emojiData';

export function PageIcon({ icon, size = 20, className }: { icon?: string; size?: number; className?: string }) {
    if (!icon) return null;
    if (icon.startsWith('icon:')) {
        const [, name, color] = icon.split(':');
        const Icon = ICONS[name] ?? FileText;
        return <Icon size={size} strokeWidth={1.9} style={{ color: color || undefined }} className={className} />;
    }
    if (icon.startsWith('img:')) {
        return (
            <img
                src={icon.slice(4)}
                alt=""
                className={`rounded-[4px] object-cover ${className ?? ''}`}
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <span
            className={`inline-flex items-center justify-center leading-none ${className ?? ''}`}
            style={{ fontSize: size * 0.92, width: size, height: size }}
        >
            {icon}
        </span>
    );
}

/* ── Picker ──────────────────────────────────────────────────────────── */

const RECENT_KEY = 'focuznow_recent_emoji';
const TONE_KEY = 'focuznow_emoji_tone';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
    recent: Clock,
    people: Smile,
    nature: Leaf,
    food: Apple,
    activity: Trophy,
    travel: Plane,
    objects: Lightbulb,
    symbols: Heart,
};

function readRecent(): string[] {
    try {
        const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, 24) : [];
    } catch {
        return [];
    }
}

function readTone(): number {
    try {
        const n = Number(localStorage.getItem(TONE_KEY));
        return Number.isInteger(n) && n >= 0 && n < SKIN_TONES.length ? n : 0;
    } catch {
        return 0;
    }
}

/** Downscales an image file to a small square PNG data URL for local storage. */
async function fileToIconDataUrl(file: File, px = 128): Promise<string> {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, px, px);
        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(url);
    }
}

type Tab = 'emoji' | 'icons' | 'upload';

/** Categories built right away when the picker opens; the rest follow while the browser is idle. */
const FIRST_CATEGORIES = 1;
const COLUMNS = 12;
/** Filter matches shown at most (12 rows): a one-letter filter matches most of the set. */
const MAX_RESULTS = 144;
/** Rows per layout chunk: only chunks near the viewport get laid out and painted. */
const CHUNK_ROWS = 4;
const ROW_PX = 33;
/** Name the colour emoji fonts, so each glyph doesn't trigger a system-wide font fallback search. */
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';

/** A few glyphs drawn off screen while idle, so the emoji font is loaded before the picker first opens. */
const WARM_GLYPHS = '😀🐶🍎⚽✈️💡❤️👋🏽';

/** A 12-column emoji grid split into row chunks that the browser can skip while off screen. */
function EmojiRows({ entries, tone, onPick }: { entries: EmojiEntry[]; tone: number; onPick: (emoji: string) => void }) {
    const perChunk = COLUMNS * CHUNK_ROWS;
    const chunks: EmojiEntry[][] = [];
    for (let i = 0; i < entries.length; i += perChunk) chunks.push(entries.slice(i, i + perChunk));
    return (
        <div style={{ fontFamily: EMOJI_FONT }}>
            {chunks.map((chunk, c) => (
                <div
                    key={c}
                    className="grid grid-cols-12 gap-px"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${Math.ceil(chunk.length / COLUMNS) * ROW_PX}px` }}
                >
                    {chunk.map((entry, i) => {
                        const shown = withSkinTone(entry, tone);
                        return (
                            <button
                                key={i}
                                type="button"
                                title={entry.n.split(' ').slice(0, 3).join(' ')}
                                onClick={() => onPick(shown)}
                                className="flex size-8 items-center justify-center rounded-md text-[22px] leading-none transition-colors hover:bg-[var(--fz-bg-hover)]"
                            >
                                {shown}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

/**
 * One category. Memoized, so typing in the filter, the tone menu and editor re-renders don't
 * rebuild ~1000 buttons. Laying out every colour emoji glyph at once was most of the lag, so the
 * rows are chunked (see EmojiRows) and only the ones near the viewport are laid out.
 */
const EmojiSection = memo(function EmojiSection({
    id,
    label,
    emojis,
    tone,
    onPick,
}: {
    id: string;
    label: string;
    emojis: EmojiEntry[];
    tone: number;
    onPick: (emoji: string) => void;
}) {
    return (
        <section data-cat={id}>
            <p className="sticky top-0 z-[1] bg-[var(--fz-bg-overlay)] px-1 pb-1 pt-2 text-[11.5px] font-medium text-[var(--fz-text-3)]">
                {label}
            </p>
            <EmojiRows entries={emojis} tone={tone} onPick={onPick} />
        </section>
    );
});

export function EmojiPicker({
    open,
    onClose,
    anchor,
    onSelect,
    onRemove,
}: {
    open: boolean;
    onClose: () => void;
    anchor: RefObject<HTMLElement | null>;
    onSelect: (icon: string) => void;
    onRemove?: () => void;
}) {
    const [tab, setTab] = useState<Tab>('emoji');
    const [query, setQuery] = useState('');
    const [tone, setTone] = useState(readTone);
    const [toneOpen, setToneOpen] = useState(false);
    const [recent, setRecent] = useState(readRecent);
    const [iconColor, setIconColor] = useState(ICON_COLORS[0]);
    const [linkUrl, setLinkUrl] = useState('');
    const [uploadError, setUploadError] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const [lingering, setLingering] = useState(false);
    const [revealed, setRevealed] = useState(FIRST_CATEGORIES);
    const [warm, setWarm] = useState(false);

    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb: () => void, _opts?: { timeout: number }) => window.setTimeout(cb, 300));
        const cancel = window.cancelIdleCallback ?? window.clearTimeout;
        const handle = idle(() => setWarm(true), { timeout: 3000 });
        return () => cancel(handle);
    }, []);

    useEffect(() => {
        if (!open) return;
        const t = window.setTimeout(() => searchRef.current?.focus(), 30);
        return () => window.clearTimeout(t);
    }, [open, tab]);

    useEffect(() => {
        if (open) {
            setLingering(true);
            return;
        }
        const t = window.setTimeout(() => {
            setLingering(false);
            setRevealed(FIRST_CATEGORIES);
        }, 400);
        return () => window.clearTimeout(t);
    }, [open]);

    // Fill in the remaining categories one idle moment at a time, so opening stays instant.
    useEffect(() => {
        if (!open || tab !== 'emoji' || revealed >= EMOJI_CATEGORIES.length) return;
        const idle = window.requestIdleCallback ?? ((cb: () => void, _opts?: { timeout: number }) => window.setTimeout(cb, 16));
        const cancel = window.cancelIdleCallback ?? window.clearTimeout;
        const handle = idle(() => setRevealed((n) => n + 1), { timeout: 120 });
        return () => cancel(handle);
    }, [open, tab, revealed]);

    const pick = (icon: string) => {
        if (!icon.startsWith('icon:') && !icon.startsWith('img:')) {
            const next = [icon, ...recent.filter((e) => e !== icon)].slice(0, 24);
            setRecent(next);
            try {
                localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            } catch {
                /* recents are a nicety */
            }
        }
        onSelect(icon);
        onClose();
    };
    // A stable callback for the memoized sections, always calling the latest pick().
    const pickRef = useRef(pick);
    useLayoutEffect(() => {
        pickRef.current = pick;
    });
    const pickEmoji = useCallback((emoji: string) => pickRef.current(emoji), []);

    // The filter field updates at once; the (possibly long) result grid follows at lower priority.
    const deferredQuery = useDeferredValue(query);
    const filtering = deferredQuery.trim() !== '';
    const results = useMemo(() => searchEmoji(deferredQuery).slice(0, MAX_RESULTS), [deferredQuery]);
    const iconResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        return Object.keys(ICONS).filter((name) => !q || name.toLowerCase().includes(q));
    }, [query]);

    const randomEmoji = () => {
        const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
        pick(withSkinTone(all[Math.floor(Math.random() * all.length)], tone));
    };

    const jumpTo = (id: string) => {
        setQuery('');
        setRevealed(EMOJI_CATEGORIES.length);
        requestAnimationFrame(() => {
            const el = scrollRef.current?.querySelector<HTMLElement>(`[data-cat="${id}"]`);
            if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 4;
        });
    };

    const tabBtn = (id: Tab, label: string) => (
        <button
            type="button"
            onClick={() => {
                setTab(id);
                setQuery('');
            }}
            className={`relative h-9 px-1 text-[13px] transition-colors ${
                tab === id ? 'font-medium text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)] hover:text-[var(--fz-text-2)]'
            }`}
        >
            {label}
            {tab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--fz-text-1)]" />}
        </button>
    );

    const searchRow = (placeholder: string, extras?: ReactNode) => (
        <div className="flex items-center gap-2 px-3 pt-3">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 focus-within:border-[var(--fz-border-strong)]">
                <Search size={13} className="shrink-0 text-[var(--fz-text-4)]" />
                <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                />
            </label>
            {extras}
        </div>
    );

    // The grid is thousands of buttons and the editor re-renders on every keystroke, so
    // only build it while the picker is open (or still animating closed).
    if (!open && !lingering) {
        return (
            <>
                {warm && (
                    <span aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 text-[22px]" style={{ fontFamily: EMOJI_FONT }}>
                        {WARM_GLYPHS}
                    </span>
                )}
                <Popover open={false} onClose={onClose} anchor={anchor}>
                    {null}
                </Popover>
            </>
        );
    }

    return (
        <Popover open={open} onClose={onClose} anchor={anchor} className="w-[408px] overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--fz-border)] px-3">
                <div className="flex items-center gap-4">
                    {tabBtn('emoji', 'Emoji')}
                    {tabBtn('icons', 'Icons')}
                    {tabBtn('upload', 'Upload')}
                </div>
                {onRemove && (
                    <button
                        type="button"
                        onClick={() => {
                            onRemove();
                            onClose();
                        }}
                        className="rounded-md px-2 py-1 text-[13px] text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                    >
                        Remove
                    </button>
                )}
            </div>

            {tab === 'emoji' && (
                <>
                    {searchRow(
                        'Filter…',
                        <>
                            <button
                                type="button"
                                onClick={randomEmoji}
                                title="Random"
                                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--fz-border)] text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                            >
                                <Shuffle size={14} />
                            </button>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setToneOpen((v) => !v)}
                                    title="Skin tone"
                                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-[20px] leading-none transition-colors hover:bg-[var(--fz-bg-hover)]"
                                >
                                    {`✋${SKIN_TONES[tone]}`}
                                </button>
                                {toneOpen && (
                                    <div className="absolute right-0 top-9 z-10 flex gap-0.5 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1 shadow-[var(--fz-shadow-overlay)]">
                                        {SKIN_TONES.map((mod, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => {
                                                    setTone(i);
                                                    setToneOpen(false);
                                                    try {
                                                        localStorage.setItem(TONE_KEY, String(i));
                                                    } catch {
                                                        /* nicety */
                                                    }
                                                }}
                                                className={`flex size-8 items-center justify-center rounded-md text-[20px] leading-none hover:bg-[var(--fz-bg-hover)] ${
                                                    tone === i ? 'bg-[var(--fz-bg-selected)]' : ''
                                                }`}
                                            >
                                                {`✋${mod}`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>,
                    )}
                    <div ref={scrollRef} className="cal-scroll relative h-[272px] overflow-y-auto px-2 pb-2 pt-1">
                        {filtering &&
                            (results.length ? (
                                <div className="pt-1">
                                    <EmojiRows entries={results} tone={tone} onPick={pickEmoji} />
                                </div>
                            ) : (
                                <p className="px-2 py-10 text-center text-[13px] text-[var(--fz-text-3)]">No emoji match “{deferredQuery.trim()}”.</p>
                            ))}
                        {/* Hidden, not unmounted, while filtering: clearing the filter is then instant. */}
                        <div hidden={filtering}>
                            {recent.length > 0 && (
                                <section data-cat="recent">
                                    <p className="sticky top-0 z-[1] bg-[var(--fz-bg-overlay)] px-1 pb-1 pt-2 text-[11.5px] font-medium text-[var(--fz-text-3)]">
                                        Recent
                                    </p>
                                    <div className="grid grid-cols-12 gap-px" style={{ fontFamily: EMOJI_FONT }}>
                                        {recent.map((e, i) => (
                                            <button
                                                key={`recent-${i}`}
                                                type="button"
                                                onClick={() => pick(e)}
                                                className="flex size-8 items-center justify-center rounded-md text-[22px] leading-none transition-colors hover:bg-[var(--fz-bg-hover)]"
                                            >
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}
                            {EMOJI_CATEGORIES.slice(0, revealed).map((cat) => (
                                <EmojiSection key={cat.id} id={cat.id} label={cat.label} emojis={cat.emojis} tone={tone} onPick={pickEmoji} />
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--fz-border)] px-2 py-1.5">
                        {['recent', ...EMOJI_CATEGORIES.map((c) => c.id)].map((id) => {
                            const Icon = CATEGORY_ICONS[id];
                            if (id === 'recent' && !recent.length) return null;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => jumpTo(id)}
                                    title={id === 'recent' ? 'Recent' : EMOJI_CATEGORIES.find((c) => c.id === id)?.label}
                                    className="flex size-8 items-center justify-center rounded-md text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                >
                                    <Icon size={16} strokeWidth={1.75} />
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {tab === 'icons' && (
                <>
                    {searchRow('Filter icons…')}
                    <div className="flex items-center gap-1.5 px-3 pt-2.5">
                        {ICON_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setIconColor(color)}
                                aria-label={`Icon color ${color}`}
                                className={`size-5 rounded-full transition-transform hover:scale-110 ${
                                    iconColor === color ? 'ring-2 ring-[var(--fz-text-1)] ring-offset-2 ring-offset-[var(--fz-bg-overlay)]' : ''
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <div className="cal-scroll grid h-[300px] grid-cols-10 content-start gap-px overflow-y-auto px-2 pb-2 pt-2">
                        {iconResults.map((name) => {
                            const Icon = ICONS[name];
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    title={name}
                                    onClick={() => pick(`icon:${name}:${iconColor}`)}
                                    className="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--fz-bg-hover)]"
                                >
                                    <Icon size={18} strokeWidth={1.9} style={{ color: iconColor }} />
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {tab === 'upload' && (
                <div className="space-y-3 p-3">
                    <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--fz-border-strong)] text-[13px] text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)]">
                        <Upload size={18} className="text-[var(--fz-text-3)]" />
                        Upload an image
                        <span className="text-meta">Square works best · shrunk to 128px</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                try {
                                    pick(`img:${await fileToIconDataUrl(file)}`);
                                } catch {
                                    setUploadError('That image could not be read.');
                                }
                            }}
                        />
                    </label>
                    <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const url = linkUrl.trim();
                            if (/^https?:\/\//i.test(url)) pick(`img:${url}`);
                            else setUploadError('Paste a full image link starting with https://');
                        }}
                    >
                        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 focus-within:border-[var(--fz-border-strong)]">
                            <ImageIcon size={13} className="shrink-0 text-[var(--fz-text-4)]" />
                            <input
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder="Or paste an image link…"
                                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                            />
                        </label>
                        <button
                            type="submit"
                            className="flex h-8 items-center gap-1 rounded-md bg-[var(--fz-accent)] px-3 text-[13px] font-medium text-[var(--fz-accent-fg)]"
                        >
                            <Check size={13} />
                            Use
                        </button>
                    </form>
                    {uploadError && <p className="text-[12px] text-[var(--fz-danger)]">{uploadError}</p>}
                </div>
            )}
        </Popover>
    );
}

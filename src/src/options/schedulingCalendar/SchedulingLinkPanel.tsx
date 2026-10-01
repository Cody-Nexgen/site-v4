import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isBefore,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import {
    AlertCircle,
    AlignLeft,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Globe,
    Loader2,
    MapPin,
    Phone,
    Plus,
    Video,
    X,
} from 'lucide-react';
import type { CalendarGroup, SchedulingLink } from '../../lib/schedulingTypes';
import { isSchedulingSlugAvailable } from '../../lib/schedulingApi';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Sheet } from '../../components/fz/Sheet';
import { Button } from '../../components/fz/Button';
import { Dialog } from '../../components/fz/Dialog';
import { Switch } from '../../components/fz/Switch';
import { Checkbox } from '../../components/fz/Checkbox';
import { Menu } from '../../components/fz/Menu';
import { TIMEZONE_OPTIONS, timezoneLabel, currentTimezoneId } from './timezones';

export type LinkLocationType = 'link' | 'phone' | 'in_person' | 'custom';

export type WeekdaySlot = { start: string; end: string };

export type LinkDraft = {
    title: string;
    slug: string;
    durationMin: number;
    singleUse: boolean;
    linkExpires: boolean;
    expiresAt: string;
    timezone: string;
    description: string;
    locationType: LinkLocationType;
    locationValue: string;
    avoidConflicts: boolean;
    groupId: string;
    /** Recurring: which weekdays have time ranges */
    weekdaySlots: Record<number, WeekdaySlot>;
    /** Specific dates picked on calendar */
    pickedDates: string[];
    /** Per-date start/end for one-off (yyyy-MM-dd) */
    dateSlots: Record<string, WeekdaySlot>;
    /** Repeat weekly on these weekdays (0=Sun) */
    repeatWeekdays: number[];
    bookingNoticeHours: number;
    bookingWindowDays: number;
};


export function linkDraftFromSchedulingLink(link: SchedulingLink): LinkDraft {
    const slots: Record<number, WeekdaySlot> = {};
    if (link.weekdayAvailability) {
        Object.entries(link.weekdayAvailability).forEach(([dow, w]) => {
            slots[parseInt(dow, 10)] = {
                start: `${String(w.startHour).padStart(2, '0')}:${String(w.startMin).padStart(2, '0')}`,
                end: `${String(w.endHour).padStart(2, '0')}:${String(w.endMin).padStart(2, '0')}`,
            };
        });
    } else {
        link.availability.days.forEach((d) => {
            slots[d] = {
                start: `${String(link.availability.startHour).padStart(2, '0')}:${String(link.availability.startMin).padStart(2, '0')}`,
                end: `${String(link.availability.endHour).padStart(2, '0')}:${String(link.availability.endMin).padStart(2, '0')}`,
            };
        });
    }
    const dateSlots: Record<string, WeekdaySlot> = {};
    const pickedDates = link.specificDates ?? [];
    if (link.dateAvailability) {
        Object.entries(link.dateAvailability).forEach(([key, w]) => {
            dateSlots[key] = {
                start: `${String(w.startHour).padStart(2, '0')}:${String(w.startMin).padStart(2, '0')}`,
                end: `${String(w.endHour).padStart(2, '0')}:${String(w.endMin).padStart(2, '0')}`,
            };
        });
    }
    let expiresAt = '';
    if (link.expiresAt) {
        const d = new Date(link.expiresAt);
        if (!Number.isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            expiresAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
    }
    return {
        title: link.title,
        slug: link.slug,
        durationMin: link.durationMin || 30,
        singleUse: !!link.singleUse,
        linkExpires: !!link.expiresAt,
        expiresAt,
        timezone: link.timezone || currentTimezoneId(),
        description: link.description || '',
        locationType: (link.locationType as LinkLocationType) || 'link',
        locationValue: link.locationValue || '',
        avoidConflicts: true,
        groupId: '',
        weekdaySlots: Object.keys(slots).length ? slots : defaultLinkDraft(link.hostName).weekdaySlots,
        pickedDates,
        dateSlots,
        repeatWeekdays: link.availability.days.length ? link.availability.days : [1, 2, 3, 4, 5],
        bookingNoticeHours: link.bookingNoticeHours ?? 1,
        bookingWindowDays: link.bookingWindowDays ?? 30,
    };
}

export function defaultLinkDraft(displayName: string): LinkDraft {
    const slots: Record<number, WeekdaySlot> = {};
    [1, 2, 3, 4, 5].forEach((d) => {
        slots[d] = { start: '09:00', end: '17:00' };
    });
    const base = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'host';
    return {
        title: `Meeting with ${displayName}`,
        slug: `${base}-meeting`,
        durationMin: 30,
        singleUse: false,
        linkExpires: false,
        expiresAt: '',
        timezone: currentTimezoneId(),
        description: '',
        locationType: 'link',
        locationValue: '',
        avoidConflicts: true,
        groupId: '',
        weekdaySlots: slots,
        pickedDates: [],
        dateSlots: {},
        repeatWeekdays: [1, 2, 3, 4, 5],
        bookingNoticeHours: 1,
        bookingWindowDays: 30,
    };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Weekly hours list order — Monday first, like most booking tools. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const NOTICE_OPTIONS = [0, 1, 2, 4, 12, 24, 48, 168];
const WINDOW_OPTIONS = [7, 14, 30, 60, 90, 180, 365];

function durationLabel(min: number): string {
    if (min < 60) return `${min} min`;
    const h = min / 60;
    return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hr`;
}

function noticeLabel(h: number): string {
    if (h === 0) return 'No minimum';
    if (h === 168) return '1 week';
    if (h >= 24 && h % 24 === 0) return h === 24 ? '1 day' : `${h / 24} days`;
    return h === 1 ? '1 hour' : `${h} hours`;
}

function windowLabel(d: number): string {
    if (d === 365) return '1 year';
    if (d % 7 === 0 && d <= 14) return d === 7 ? '1 week' : `${d / 7} weeks`;
    return `${d} days`;
}

/** Preset options plus the draft's current value when it's a custom one. */
function withCurrent(presets: number[], current: number): number[] {
    return presets.includes(current) ? presets : [...presets, current].sort((a, b) => a - b);
}

const slugify = (v: string) =>
    v
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-/, '');

/* ── Layout primitives ─────────────────────────────────────────────── */

type GhostOption = { value: string; label: string; icon?: ReactNode };

/** Borderless dropdown — reads as plain text until hovered. */
function GhostSelect({
    value,
    options,
    onChange,
    ariaLabel,
    align = 'start',
}: {
    value: string;
    options: GhostOption[];
    onChange: (v: string) => void;
    ariaLabel: string;
    align?: 'start' | 'end';
}) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    const current = options.find((o) => o.value === value);
    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--fz-text-1)] transition-colors hover:bg-[var(--fz-bg-hover)] aria-expanded:bg-[var(--fz-bg-hover)]"
            >
                <span className="truncate">{current?.label ?? value}</span>
                <ChevronDown size={12} strokeWidth={2} className="shrink-0 text-[var(--fz-text-4)]" />
            </button>
            <Menu
                open={open}
                onClose={() => setOpen(false)}
                anchor={anchorRef}
                align={align}
                items={options.map((o) => ({
                    id: o.value,
                    label: o.label,
                    icon: o.icon,
                    checked: o.value === value,
                    onSelect: () => onChange(o.value),
                }))}
            />
        </>
    );
}

/** Icon + value line, like an event's properties. */
function PropertyRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex min-h-8 items-center gap-2">
            <span className="flex w-5 shrink-0 justify-center text-[var(--fz-text-4)]">{icon}</span>
            <div className="-ml-0.5 min-w-0 flex-1">{children}</div>
        </div>
    );
}

/** Label on the left, control on the right — used inside "More options". */
function OptionRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-h-9 items-center justify-between gap-4">
            <span className="text-[13px] text-[var(--fz-text-2)]">{label}</span>
            <div className="flex shrink-0 items-center">{children}</div>
        </div>
    );
}

const ghostField =
    'h-8 w-full rounded-md bg-[var(--fz-bg-hover)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)] focus:shadow-[inset_0_0_0_1px_var(--fz-border-strong)]';

function TimeInput({
    value,
    onChange,
    label,
    invalid,
}: {
    value: string;
    onChange: (v: string) => void;
    label: string;
    invalid?: boolean;
}) {
    return (
        <input
            type="time"
            value={value}
            aria-label={label}
            aria-invalid={invalid || undefined}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => {
                try {
                    e.currentTarget.showPicker?.();
                } catch {
                    /* picker not allowed here — typing still works */
                }
            }}
            className={`h-7 w-[84px] rounded-md bg-transparent px-1.5 text-[13px] tabular-nums outline-none transition-colors hover:bg-[var(--fz-bg-hover)] focus:bg-[var(--fz-bg-hover)] [&::-webkit-calendar-picker-indicator]:hidden ${
                invalid ? 'text-[var(--fz-danger)]' : 'text-[var(--fz-text-1)]'
            }`}
        />
    );
}

function TimeRange({ slot, onChange, label }: { slot: WeekdaySlot; onChange: (s: WeekdaySlot) => void; label: string }) {
    return (
        <div className="flex items-center">
            <TimeInput value={slot.start} onChange={(start) => onChange({ ...slot, start })} label={`${label} start`} />
            <span className="px-0.5 text-[13px] text-[var(--fz-text-4)]">–</span>
            <TimeInput
                value={slot.end}
                onChange={(end) => onChange({ ...slot, end })}
                label={`${label} end`}
                invalid={slot.end <= slot.start}
            />
        </div>
    );
}

type AddressHit = { label: string; placeId: string };

function AddressAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [hits, setHits] = useState<AddressHit[]>([]);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<number | null>(null);

    useEffect(() => {
        const q = value.trim();
        if (q.length < 4) {
            setHits([]);
            setOpen(false);
            return;
        }
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            void fetch(
                `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
                { headers: { Accept: 'application/json' } },
            )
                .then((r) => r.json())
                .then((rows: { display_name?: string; place_id?: number }[]) => {
                    setHits(
                        (rows || []).map((row) => ({
                            label: row.display_name || '',
                            placeId: String(row.place_id ?? ''),
                        })),
                    );
                    setOpen(true);
                })
                .catch(() => setHits([]));
        }, 320);
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, [value]);

    return (
        <div className="relative">
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => hits.length > 0 && setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 120)}
                placeholder="Start typing an address…"
                aria-label="Address"
                className={ghostField}
            />
            {open && hits.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1 shadow-[var(--fz-shadow-overlay)]">
                    {hits.map((h) => (
                        <button
                            key={h.placeId}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                onChange(h.label);
                                setOpen(false);
                            }}
                            className="w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-[var(--fz-text-2)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                        >
                            {h.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function LinkHost({ url }: { url: string }) {
    let host = '';
    try {
        host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
    if (!host.includes('.')) return null;
    return (
        <p className="text-meta mt-1.5 flex items-center gap-1.5">
            <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" className="size-3.5 rounded-sm" />
            {host}
        </p>
    );
}

/* ── Date picker (one-off links) ───────────────────────────────────── */

function DatePickerDialog({
    open,
    onClose,
    draft,
    onChange,
}: {
    open: boolean;
    onClose: () => void;
    draft: LinkDraft;
    onChange: (d: LinkDraft) => void;
}) {
    const [month, setMonth] = useState(() => startOfMonth(new Date()));
    const today = startOfDay(new Date());
    const days = eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) });

    const toggleDate = (d: Date) => {
        const key = format(d, 'yyyy-MM-dd');
        if (draft.pickedDates.includes(key)) {
            const restSlots = { ...draft.dateSlots };
            delete restSlots[key];
            onChange({ ...draft, pickedDates: draft.pickedDates.filter((x) => x !== key), dateSlots: restSlots });
        } else {
            onChange({
                ...draft,
                pickedDates: [...draft.pickedDates, key].sort(),
                dateSlots: { ...draft.dateSlots, [key]: draft.weekdaySlots[d.getDay()] ?? { start: '09:00', end: '17:00' } },
            });
        }
    };

    const navBtn =
        'flex size-7 items-center justify-center rounded-md text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Pick dates"
            size="sm"
            footer={
                <Button variant="primary" size="sm" onClick={onClose}>
                    Done
                </Button>
            }
        >
            <div className="mb-2 flex items-center justify-between">
                <span className="pl-1 text-[13px] font-semibold text-[var(--fz-text-1)]">{format(month, 'MMMM yyyy')}</span>
                <div className="flex items-center">
                    <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} className={navBtn} aria-label="Previous month">
                        <ChevronLeft size={15} strokeWidth={1.75} />
                    </button>
                    <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className={navBtn} aria-label="Next month">
                        <ChevronRight size={15} strokeWidth={1.75} />
                    </button>
                </div>
            </div>
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-[var(--fz-text-4)]">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <span key={i} className="py-1">
                        {d}
                    </span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const selected = draft.pickedDates.includes(key);
                    const past = isBefore(day, today);
                    const inMonth = isSameMonth(day, month);
                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={past}
                            onClick={() => toggleDate(day)}
                            aria-pressed={selected}
                            className={`flex h-9 items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors disabled:cursor-default disabled:opacity-35 ${
                                selected
                                    ? 'bg-[var(--fz-accent)] font-semibold text-[var(--fz-accent-fg)]'
                                    : `hover:bg-[var(--fz-bg-hover)] ${
                                          isSameDay(day, today) ? 'font-semibold text-[var(--fz-text-1)] ring-1 ring-inset ring-[var(--fz-border-strong)]' : ''
                                      } ${inMonth ? 'text-[var(--fz-text-2)]' : 'text-[var(--fz-text-4)]'}`
                            }`}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
            <p className="text-meta mt-3 px-1">
                {draft.pickedDates.length === 0
                    ? 'Click days to add them.'
                    : `${draft.pickedDates.length} ${draft.pickedDates.length === 1 ? 'date' : 'dates'} selected`}
            </p>
        </Dialog>
    );
}

/* ── Panel ─────────────────────────────────────────────────────────── */

type Props = {
    mode: 'recurring' | 'oneoff';
    draft: LinkDraft;
    onChange: (d: LinkDraft) => void;
    onClose: () => void;
    onCreate: () => void;
    hostEmail: string;
    previewSlug: string;
    groups: CalendarGroup[];
    editingLinkId?: string | null;
};

const LOCATION_ICON: Record<LinkLocationType, ReactNode> = {
    link: <Video size={14} strokeWidth={1.75} />,
    phone: <Phone size={14} strokeWidth={1.75} />,
    in_person: <MapPin size={14} strokeWidth={1.75} />,
    custom: <AlignLeft size={14} strokeWidth={1.75} />,
};

export default function SchedulingLinkPanel({
    mode,
    draft,
    onChange,
    onClose,
    onCreate,
    previewSlug,
    groups,
    editingLinkId = null,
}: Props) {
    const { session } = useAuthStore();
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [showDates, setShowDates] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const customGroups = groups.filter((g) => g.kind === 'custom');

    const patch = (p: Partial<LinkDraft>) => onChange({ ...draft, ...p });

    useEffect(() => {
        const slug = draft.slug.trim().toLowerCase();
        if (!slug || !session?.user?.id) {
            setSlugStatus('idle');
            return;
        }
        setSlugStatus('checking');
        const t = window.setTimeout(() => {
            void isSchedulingSlugAvailable(supabase, slug, editingLinkId ?? undefined)
                .then((res) => setSlugStatus(res.available ? 'available' : 'taken'))
                .catch(() => setSlugStatus('idle'));
        }, 400);
        return () => window.clearTimeout(t);
    }, [draft.slug, editingLinkId, session?.user?.id]);

    const setWeekday = (dow: number, slot: WeekdaySlot | null) => {
        const slots = { ...draft.weekdaySlots };
        if (slot) slots[dow] = slot;
        else delete slots[dow];
        patch({ weekdaySlots: slots });
    };

    const removeDate = (key: string) => {
        const rest = { ...draft.dateSlots };
        delete rest[key];
        patch({ pickedDates: draft.pickedDates.filter((k) => k !== key), dateSlots: rest });
    };

    const timezoneOptions = TIMEZONE_OPTIONS.some((t) => t.id === draft.timezone)
        ? TIMEZONE_OPTIONS
        : [{ id: draft.timezone, label: timezoneLabel(draft.timezone) }, ...TIMEZONE_OPTIONS];

    // Saving re-checks the slug, so a slow check never blocks the button.
    const canSave = draft.title.trim().length > 0 && slugStatus !== 'taken';

    const moreSummary = [
        draft.bookingNoticeHours ? `${noticeLabel(draft.bookingNoticeHours)} notice` : 'No notice needed',
        `up to ${windowLabel(draft.bookingWindowDays)} ahead`,
        draft.avoidConflicts ? 'skips busy times' : null,
        draft.singleUse ? 'single use' : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <Sheet
            open
            onClose={onClose}
            side="right"
            title={
                <span className="flex items-center gap-2">
                    {editingLinkId ? 'Edit booking link' : 'New booking link'}
                    <span className="text-meta font-normal text-[var(--fz-text-4)]">
                        {mode === 'recurring' ? 'Recurring' : 'One-off'}
                    </span>
                </span>
            }
            footer={
                <>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={onCreate} disabled={!canSave}>
                        {editingLinkId ? 'Save changes' : 'Create link'}
                    </Button>
                </>
            }
        >
            <DatePickerDialog open={showDates} onClose={() => setShowDates(false)} draft={draft} onChange={onChange} />

            <div className="space-y-6">
                {/* Name + public URL */}
                <div>
                    <input
                        value={draft.title}
                        onChange={(e) => patch({ title: e.target.value })}
                        placeholder="Meeting name"
                        aria-label="Meeting name"
                        className="w-full bg-transparent text-[20px] font-semibold tracking-[-0.015em] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                    />
                    <div className="mt-1 flex items-center text-[12.5px]">
                        <span className="shrink-0 text-[var(--fz-text-4)]">focuznow.com/schedule/</span>
                        <input
                            value={draft.slug}
                            onChange={(e) => patch({ slug: slugify(e.target.value) })}
                            onBlur={() => draft.slug.endsWith('-') && patch({ slug: draft.slug.replace(/-+$/, '') })}
                            placeholder={previewSlug}
                            aria-label="Link URL"
                            className="-ml-0.5 min-w-0 flex-1 rounded px-0.5 bg-transparent text-[var(--fz-text-2)] outline-none transition-colors hover:bg-[var(--fz-bg-hover)] focus:bg-[var(--fz-bg-hover)] focus:text-[var(--fz-text-1)] placeholder:text-[var(--fz-text-4)]"
                        />
                        <span className="ml-1 flex size-4 shrink-0 items-center justify-center" aria-live="polite">
                            {slugStatus === 'checking' && (
                                <Loader2 size={12} className="animate-spin text-[var(--fz-text-4)]" aria-label="Checking URL" />
                            )}
                            {slugStatus === 'available' && (
                                <Check size={12} strokeWidth={2.25} className="text-[var(--fz-text-3)]" aria-label="URL available" />
                            )}
                            {slugStatus === 'taken' && (
                                <AlertCircle size={12} className="text-[var(--fz-danger)]" aria-label="URL taken" />
                            )}
                        </span>
                    </div>
                    {slugStatus === 'taken' && (
                        <p className="text-meta mt-1 text-[var(--fz-danger)]">That URL is taken — try another.</p>
                    )}
                </div>

                {/* Properties */}
                <div className="space-y-0.5">
                    <PropertyRow icon={<Clock size={14} strokeWidth={1.75} />}>
                        <GhostSelect
                            ariaLabel="Duration"
                            value={String(draft.durationMin)}
                            onChange={(v) => patch({ durationMin: Number(v) })}
                            options={withCurrent(DURATION_OPTIONS, draft.durationMin).map((m) => ({
                                value: String(m),
                                label: durationLabel(m),
                            }))}
                        />
                    </PropertyRow>
                    <PropertyRow icon={LOCATION_ICON[draft.locationType]}>
                        <GhostSelect
                            ariaLabel="Location"
                            value={draft.locationType}
                            onChange={(v) => patch({ locationType: v as LinkLocationType, locationValue: '' })}
                            options={[
                                { value: 'link', label: 'Video call', icon: LOCATION_ICON.link },
                                { value: 'phone', label: 'Phone call', icon: LOCATION_ICON.phone },
                                { value: 'in_person', label: 'In person', icon: LOCATION_ICON.in_person },
                                { value: 'custom', label: 'Somewhere else', icon: LOCATION_ICON.custom },
                            ]}
                        />
                    </PropertyRow>
                    {draft.locationType !== 'phone' && (
                        <div className="pb-1 pl-7">
                            {draft.locationType === 'in_person' ? (
                                <AddressAutocomplete value={draft.locationValue} onChange={(v) => patch({ locationValue: v })} />
                            ) : (
                                <input
                                    value={draft.locationValue}
                                    onChange={(e) => patch({ locationValue: e.target.value })}
                                    placeholder={draft.locationType === 'link' ? 'Paste a Zoom or Meet link' : 'Where you’ll meet'}
                                    aria-label="Location details"
                                    className={ghostField}
                                />
                            )}
                            {draft.locationType === 'link' && draft.locationValue.trim().length > 4 && (
                                <LinkHost url={draft.locationValue.trim()} />
                            )}
                        </div>
                    )}
                    <PropertyRow icon={<Globe size={14} strokeWidth={1.75} />}>
                        <GhostSelect
                            ariaLabel="Time zone"
                            value={draft.timezone}
                            onChange={(tz) => patch({ timezone: tz })}
                            options={timezoneOptions.map((t) => ({ value: t.id, label: t.label }))}
                        />
                    </PropertyRow>
                </div>

                {mode === 'oneoff' && (
                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <h3 className="text-[13px] font-semibold text-[var(--fz-text-1)]">Dates</h3>
                            <button
                                type="button"
                                onClick={() => setShowDates(true)}
                                className="flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                            >
                                <Plus size={13} />
                                Add
                            </button>
                        </div>
                        {draft.pickedDates.length === 0 ? (
                            <p className="text-meta">No dates yet — add the days people can book.</p>
                        ) : (
                            draft.pickedDates.map((key) => {
                                const slot = draft.dateSlots[key] ?? { start: '09:00', end: '17:00' };
                                const label = format(new Date(`${key}T12:00:00`), 'EEE, MMM d');
                                return (
                                    <div key={key} className="group/date flex h-9 items-center gap-3">
                                        <span className="w-[92px] text-[13px] text-[var(--fz-text-1)]">{label}</span>
                                        <TimeRange
                                            slot={slot}
                                            label={label}
                                            onChange={(next) => patch({ dateSlots: { ...draft.dateSlots, [key]: next } })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeDate(key)}
                                            className="ml-auto flex size-7 items-center justify-center rounded-md text-[var(--fz-text-4)] opacity-0 transition hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] focus-visible:opacity-100 group-hover/date:opacity-100"
                                            aria-label={`Remove ${label}`}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Weekly hours */}
                <div>
                    <h3 className="text-[13px] font-semibold text-[var(--fz-text-1)]">
                        {mode === 'recurring' ? 'Weekly hours' : 'Every week too'}
                    </h3>
                    {mode === 'oneoff' && <p className="text-meta mt-0.5">Optional — leave all unchecked for dates only.</p>}
                    <div className="mt-1.5">
                        {WEEK_ORDER.map((dow) => {
                            const slot = draft.weekdaySlots[dow];
                            return (
                                <div key={dow} className="flex h-9 items-center gap-3">
                                    <Checkbox
                                        checked={Boolean(slot)}
                                        onCheckedChange={(on) => setWeekday(dow, on ? { start: '09:00', end: '17:00' } : null)}
                                        aria-label={`Available on ${DAY_NAMES[dow]}`}
                                    />
                                    <span className={`w-10 text-[13px] ${slot ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-4)]'}`}>
                                        {DAY_NAMES[dow].slice(0, 3)}
                                    </span>
                                    {slot ? (
                                        <TimeRange slot={slot} onChange={(next) => setWeekday(dow, next)} label={DAY_NAMES[dow]} />
                                    ) : (
                                        <span className="px-1.5 text-[13px] text-[var(--fz-text-4)]">Unavailable</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Everything else, folded away */}
                <div className="border-t border-[var(--fz-border)] pt-4">
                    <button
                        type="button"
                        onClick={() => setShowMore((v) => !v)}
                        aria-expanded={showMore}
                        className="flex w-full items-start justify-between gap-3 text-left"
                    >
                        <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-[var(--fz-text-1)]">More options</span>
                            {!showMore && <span className="text-meta mt-0.5 block truncate">{moreSummary}</span>}
                        </span>
                        <ChevronDown
                            size={14}
                            className={`mt-0.5 shrink-0 text-[var(--fz-text-4)] transition-transform ${showMore ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {showMore && (
                        <div className="mt-2">
                            <OptionRow label="Minimum notice">
                                <GhostSelect
                                    ariaLabel="Minimum notice"
                                    align="end"
                                    value={String(draft.bookingNoticeHours)}
                                    onChange={(v) => patch({ bookingNoticeHours: Number(v) })}
                                    options={withCurrent(NOTICE_OPTIONS, draft.bookingNoticeHours).map((h) => ({
                                        value: String(h),
                                        label: noticeLabel(h),
                                    }))}
                                />
                            </OptionRow>
                            <OptionRow label="Bookable up to">
                                <GhostSelect
                                    ariaLabel="Booking window"
                                    align="end"
                                    value={String(draft.bookingWindowDays)}
                                    onChange={(v) => patch({ bookingWindowDays: Number(v) })}
                                    options={withCurrent(WINDOW_OPTIONS, draft.bookingWindowDays).map((d) => ({
                                        value: String(d),
                                        label: `${windowLabel(d)} ahead`,
                                    }))}
                                />
                            </OptionRow>
                            {customGroups.length > 0 && (
                                <OptionRow label="Add bookings to">
                                    <GhostSelect
                                        ariaLabel="Calendar for bookings"
                                        align="end"
                                        value={draft.groupId}
                                        onChange={(v) => patch({ groupId: v })}
                                        options={[
                                            { value: '', label: 'No calendar' },
                                            ...customGroups.map((g) => ({
                                                value: g.id,
                                                label: g.name,
                                                icon: <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />,
                                            })),
                                        ]}
                                    />
                                </OptionRow>
                            )}
                            <OptionRow label="Skip times I’m busy">
                                <Switch
                                    checked={draft.avoidConflicts}
                                    onCheckedChange={(v) => patch({ avoidConflicts: v })}
                                    aria-label="Avoid conflicts"
                                />
                            </OptionRow>
                            <OptionRow label="One booking only">
                                <Switch checked={draft.singleUse} onCheckedChange={(v) => patch({ singleUse: v })} aria-label="Single use" />
                            </OptionRow>
                            <OptionRow label="Expires">
                                <Switch
                                    checked={draft.linkExpires}
                                    onCheckedChange={(v) => patch({ linkExpires: v })}
                                    aria-label="Link expires"
                                />
                            </OptionRow>
                            {draft.linkExpires && (
                                <input
                                    type="datetime-local"
                                    value={draft.expiresAt}
                                    onChange={(e) => patch({ expiresAt: e.target.value })}
                                    aria-label="Expiration date"
                                    className={`${ghostField} mb-1`}
                                />
                            )}
                            <textarea
                                value={draft.description}
                                onChange={(e) => patch({ description: e.target.value })}
                                placeholder="Note for people booking (optional)"
                                aria-label="Description"
                                rows={2}
                                className={`${ghostField} mt-2 h-auto min-h-[64px] resize-none py-2 leading-[18px]`}
                            />
                        </div>
                    )}
                </div>
            </div>
        </Sheet>
    );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    addDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import {
    ArrowRight,
    ChevronRight,
    Clock,
    Globe,
    HelpCircle,
    Link2,
    MapPin,
    MoreHorizontal,
    Phone,
    AlignLeft,
} from 'lucide-react';
import type { CalendarGroup, SchedulingLink } from '../../lib/schedulingTypes';
import { isSchedulingSlugAvailable } from '../../lib/schedulingApi';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
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

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

function formatHour12(t: string): string {
    const [h, m] = t.split(':').map((x) => parseInt(x, 10) || 0);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`;
}

const timeInputClass =
    'bg-[#1a1a1a] border border-white/10 rounded-md px-2 py-1 text-white text-xs outline-none focus:border-red-500/50 [color-scheme:dark]';

function TimeRangeInputs({
    slot,
    onChange,
    compact,
}: {
    slot: WeekdaySlot;
    onChange: (slot: WeekdaySlot) => void;
    compact?: boolean;
}) {
    return (
        <div className={`flex items-center gap-1.5 ${compact ? '' : 'flex-1 min-w-0'}`}>
            <input
                type="time"
                value={slot.start}
                onChange={(e) => onChange({ ...slot, start: e.target.value })}
                className={timeInputClass}
            />
            <ArrowRight size={12} className="text-neutral-600 shrink-0" />
            <input
                type="time"
                value={slot.end}
                onChange={(e) => onChange({ ...slot, end: e.target.value })}
                className={timeInputClass}
            />
        </div>
    );
}

type AddressHit = { label: string; placeId: string };

function AddressAutocomplete({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
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
                placeholder="Start typing an address…"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
            />
            {open && hits.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
                    {hits.map((h) => (
                        <button
                            key={h.placeId}
                            type="button"
                            onClick={() => {
                                onChange(h.label);
                                setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-white/5"
                        >
                            {h.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function NotionToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-red-600' : 'bg-neutral-600'}`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    checked ? 'translate-x-4' : 'translate-x-0'
                }`}
            />
        </button>
    );
}

function LinkPreviewCard({ url }: { url: string }) {
    let host = '';
    let title = url;
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        host = u.hostname.replace(/^www\./, '');
        title = host;
    } catch {
        host = url;
    }
    return (
        <div className="mt-2 flex gap-3 rounded-xl border border-white/10 bg-[#1a1a1a] p-3">
            <img
                src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
                alt=""
                className="w-10 h-10 rounded-lg bg-white/5 shrink-0"
            />
            <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{title}</p>
                <p className="text-xs text-neutral-500 truncate">{host || url}</p>
            </div>
        </div>
    );
}

function AvailabilityModal({
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
    const [month, setMonth] = useState(new Date());

    const monthStart = startOfMonth(month);
    const days = eachDayOfInterval({
        start: startOfWeek(monthStart),
        end: endOfWeek(endOfMonth(monthStart)),
    });

    const toggleDate = (d: Date) => {
        const key = format(d, 'yyyy-MM-dd');
        if (draft.pickedDates.includes(key)) {
            const { [key]: _removed, ...restSlots } = draft.dateSlots;
            onChange({
                ...draft,
                pickedDates: draft.pickedDates.filter((x) => x !== key),
                dateSlots: restSlots,
            });
        } else {
            onChange({
                ...draft,
                pickedDates: [...draft.pickedDates, key].sort(),
                dateSlots: {
                    ...draft.dateSlots,
                    [key]: { start: '09:00', end: '17:00' },
                },
            });
        }
    };

    const toggleRepeat = (dow: number) => {
        onChange({
            ...draft,
            repeatWeekdays: draft.repeatWeekdays.includes(dow)
                ? draft.repeatWeekdays.filter((x) => x !== dow)
                : [...draft.repeatWeekdays, dow].sort(),
        });
    };

    const summary = useMemo(() => {
        const parts: string[] = [];
        if (draft.repeatWeekdays.length) {
            parts.push(
                draft.repeatWeekdays.map((d) => format(new Date(2024, 0, 7 + d), 'EEEE')).join(', '),
            );
        }
        if (draft.pickedDates.length) {
            parts.push(
                draft.pickedDates
                    .slice(0, 4)
                    .map((k) => format(new Date(k), 'MMM d'))
                    .join(' · '),
            );
        }
        return parts.join(' · ') || 'No times selected';
    }, [draft]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-[#141414] shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <span className="text-sm font-bold text-white">Available times</span>
                    <button type="button" onClick={onClose} className="text-xs font-bold text-red-400">
                        Done
                    </button>
                </div>
                <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={() => setMonth((m) => addDays(startOfMonth(m), -1))} className="text-neutral-500">
                            ‹
                        </button>
                        <span className="text-xs font-bold">{format(month, 'MMM yyyy')}</span>
                        <button type="button" onClick={() => setMonth((m) => addDays(endOfMonth(m), 1))} className="text-neutral-500">
                            ›
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 mb-3">
                        {days.map((day) => {
                            const key = format(day, 'yyyy-MM-dd');
                            const sel = draft.pickedDates.includes(key);
                            const inMonth = isSameMonth(day, month);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleDate(day)}
                                    className={`h-8 text-[10px] font-bold rounded-md ${
                                        sel
                                            ? 'bg-red-600 text-white'
                                            : inMonth
                                              ? 'text-neutral-300 hover:bg-white/10'
                                              : 'text-neutral-700'
                                    }`}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Repeat weekly</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                        {DAY_LABELS.map((label, dow) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => toggleRepeat(dow)}
                                className={`w-9 h-9 rounded-lg text-[10px] font-bold ${
                                    draft.repeatWeekdays.includes(dow)
                                        ? 'bg-red-600/30 text-red-300 border border-red-500/50'
                                        : 'border border-white/10 text-neutral-500'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {draft.pickedDates.length > 0 && (
                        <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto border-t border-white/10 pt-3">
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                Hours for each date
                            </p>
                            {draft.pickedDates.map((key) => {
                                const slot = draft.dateSlots[key] ?? { start: '09:00', end: '17:00' };
                                return (
                                    <div key={key} className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-neutral-400 w-12 shrink-0">
                                            {format(new Date(key + 'T12:00:00'), 'MMM d')}
                                        </span>
                                        <TimeRangeInputs
                                            slot={slot}
                                            compact
                                            onChange={(next) =>
                                                onChange({
                                                    ...draft,
                                                    dateSlots: { ...draft.dateSlots, [key]: next },
                                                })
                                            }
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <p className="text-xs text-neutral-400 leading-relaxed">{summary}</p>
                </div>
            </div>
        </div>
    );
}

function TimezonePopover({
    value,
    onChange,
}: {
    value: string;
    onChange: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white"
            >
                <Globe size={14} />
                <span>{timezoneLabel(value)}</span>
            </button>
            {open && (
                <div className="absolute right-full mr-2 top-0 z-50 w-[260px] max-h-[280px] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl p-2">
                    {TIMEZONE_OPTIONS.map((tz) => (
                        <button
                            key={tz.id}
                            type="button"
                            onClick={() => {
                                onChange(tz.id);
                                setOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                                tz.id === value ? 'bg-red-600/20 text-red-300' : 'text-neutral-300 hover:bg-white/5'
                            }`}
                        >
                            {tz.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

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

export default function SchedulingLinkPanel({
    mode,
    draft,
    onChange,
    onClose,
    onCreate,
    hostEmail,
    previewSlug,
    groups,
    editingLinkId = null,
}: Props) {
    const { session } = useAuthStore();
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [showAvailability, setShowAvailability] = useState(false);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [showCustomize, setShowCustomize] = useState(false);
    const [showBookingWindow, setShowBookingWindow] = useState(false);
    const customGroups = groups.filter((g) => g.kind === 'custom');
    const selectedGroup = customGroups.find((g) => g.id === draft.groupId);

    const patch = (p: Partial<LinkDraft>) => onChange({ ...draft, ...p });

    useEffect(() => {
        const slug = draft.slug.trim().toLowerCase();
        if (!slug || !session?.user?.id) {
            setSlugStatus('idle');
            return;
        }
        setSlugStatus('checking');
        const t = window.setTimeout(() => {
            void isSchedulingSlugAvailable(supabase, slug, editingLinkId ?? undefined).then(
                (res) => {
                    setSlugStatus(res.available ? 'available' : 'taken');
                },
            );
        }, 400);
        return () => window.clearTimeout(t);
    }, [draft.slug, editingLinkId, session?.user?.id]);

    const availabilitySummary = useMemo(() => {
        const bits: string[] = [];
        if (draft.repeatWeekdays.length) {
            bits.push(
                `Weekly: ${draft.repeatWeekdays.map((d) => DAY_LABELS[d]).join(', ')}`,
            );
        }
        if (draft.pickedDates.length) {
            bits.push(`${draft.pickedDates.length} date(s) picked`);
        }
        return bits.join(' · ') || 'Set available times';
    }, [draft]);

    return (
        <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#111]">
            <AvailabilityModal
                open={showAvailability}
                onClose={() => setShowAvailability(false)}
                draft={draft}
                onChange={onChange}
            />

            {showGroupPicker && (
                <div className="fixed inset-0 z-[650] flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#1a1a1a] p-4">
                        <p className="text-sm font-bold text-white mb-3">Add to group</p>
                        <div className="space-y-1 max-h-[240px] overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    patch({ groupId: '' });
                                    setShowGroupPicker(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-neutral-400 hover:bg-white/5"
                            >
                                None
                            </button>
                            {customGroups.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => {
                                        patch({ groupId: g.id });
                                        setShowGroupPicker(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white hover:bg-white/5"
                                >
                                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                                    {g.name}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowGroupPicker(false)}
                            className="mt-3 w-full py-2 text-xs font-bold text-neutral-500"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                    <Link2 size={16} className="text-neutral-400 shrink-0" />
                    <span className="text-sm font-bold text-white truncate">
                        {mode === 'recurring' ? 'Recurring link' : 'One-off link'}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button type="button" className="p-1.5 text-neutral-500 hover:text-white">
                        <MoreHorizontal size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={onCreate}
                        disabled={slugStatus === 'taken' || slugStatus === 'checking'}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {editingLinkId ? 'Save' : 'Create'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-[13px]">
                <input
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    className="w-full bg-transparent text-xl font-bold text-white outline-none"
                />
                <p className="flex items-center gap-2 text-neutral-500 text-sm -mt-2">
                    <Clock size={14} className="text-neutral-600" />
                    {draft.durationMin} min duration
                </p>
                <p className="text-neutral-600 text-xs break-all">
                    focuznow.com/schedule/{draft.slug.trim() || previewSlug}
                </p>
                {draft.slug.trim() && slugStatus !== 'idle' && (
                    <p
                        className={`text-[11px] font-bold ${
                            slugStatus === 'checking'
                                ? 'text-neutral-500'
                                : slugStatus === 'available'
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                        }`}
                    >
                        {slugStatus === 'checking'
                            ? 'Checking availability…'
                            : slugStatus === 'available'
                              ? 'This URL is available'
                              : 'This URL is already taken'}
                    </p>
                )}
                <button
                    type="button"
                    onClick={() => setShowCustomize((v) => !v)}
                    className="flex items-center gap-1 text-neutral-500 text-sm hover:text-white w-full text-left"
                >
                    Customize link
                    <ChevronRight
                        size={14}
                        className={`transition-transform ${showCustomize ? 'rotate-90' : ''}`}
                    />
                </button>
                {showCustomize && (
                    <div className="space-y-3 pl-1 border-l border-white/10 ml-1">
                        <label className="block space-y-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                URL slug
                            </span>
                            <div className="flex items-center gap-1 text-xs text-neutral-500">
                                <span className="shrink-0">/schedule/</span>
                                <input
                                    value={draft.slug}
                                    onChange={(e) =>
                                        patch({
                                            slug: e.target.value
                                                .toLowerCase()
                                                .replace(/[^a-z0-9-]+/g, '-')
                                                .replace(/^-|-$/g, ''),
                                        })
                                    }
                                    className="flex-1 min-w-0 bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1.5 text-white font-mono"
                                />
                            </div>
                        </label>
                        <label className="block space-y-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                Duration (minutes)
                            </span>
                            <input
                                type="number"
                                min={15}
                                max={240}
                                step={15}
                                value={draft.durationMin}
                                onChange={(e) =>
                                    patch({
                                        durationMin: Math.min(
                                            240,
                                            Math.max(15, parseInt(e.target.value, 10) || 30),
                                        ),
                                    })
                                }
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </label>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-neutral-300">
                        Link expiration date <HelpCircle size={12} className="text-neutral-600" />
                    </span>
                    <NotionToggle checked={draft.linkExpires} onChange={(v) => patch({ linkExpires: v })} />
                </div>
                {draft.linkExpires && (
                    <input
                        type="datetime-local"
                        value={draft.expiresAt}
                        onChange={(e) => patch({ expiresAt: e.target.value })}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs"
                    />
                )}

                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-neutral-300">
                        Single-use link <HelpCircle size={12} className="text-neutral-600" />
                    </span>
                    <NotionToggle checked={draft.singleUse} onChange={(v) => patch({ singleUse: v })} />
                </div>

                <TimezonePopover value={draft.timezone} onChange={(tz) => patch({ timezone: tz })} />

                <div>
                    <p className="text-white font-bold mb-2">Weekly hours</p>
                    <p className="text-xs text-neutral-500 mb-2">Different times per weekday — only open slots show when booking.</p>
                    <div className="flex gap-3">
                            <div className="flex flex-col gap-1 text-[11px] font-bold text-neutral-500">
                                {DAY_LABELS.map((label, dow) => (
                                    <button
                                        key={label}
                                        type="button"
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                            draft.weekdaySlots[dow]
                                                ? 'bg-red-600 text-white'
                                                : 'text-neutral-600'
                                        }`}
                                        onClick={() => {
                                            const slots = { ...draft.weekdaySlots };
                                            if (slots[dow]) delete slots[dow];
                                            else slots[dow] = { start: '09:00', end: '17:00' };
                                            patch({ weekdaySlots: slots });
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                                {DAY_LABELS.map((label, dow) => {
                                    const slot = draft.weekdaySlots[dow];
                                    return (
                                        <div key={label} className="flex items-center gap-2 min-h-8">
                                            {slot ? (
                                                <TimeRangeInputs
                                                    slot={slot}
                                                    onChange={(next) => {
                                                        patch({
                                                            weekdaySlots: {
                                                                ...draft.weekdaySlots,
                                                                [dow]: next,
                                                            },
                                                        });
                                                    }}
                                                />
                                            ) : (
                                                <span className="text-neutral-600 text-sm">
                                                    Start <ArrowRight size={12} className="inline opacity-40" /> End
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                    </div>

                    {mode === 'oneoff' && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                                Extra dates (optional)
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowAvailability(true)}
                                className="flex items-center gap-2 w-full text-left text-neutral-400 hover:text-white text-sm font-medium"
                            >
                                <Clock size={14} />
                                Add specific dates & custom hours
                            </button>
                            {draft.pickedDates.length > 0 && (
                                <div className="space-y-1.5 pl-1">
                                    {draft.pickedDates.slice(0, 5).map((key) => {
                                        const slot = draft.dateSlots[key] ?? {
                                            start: '09:00',
                                            end: '17:00',
                                        };
                                        return (
                                            <p key={key} className="text-xs text-neutral-500">
                                                {format(new Date(key + 'T12:00:00'), 'EEE MMM d')}:{' '}
                                                {formatHour12(slot.start)} – {formatHour12(slot.end)}
                                            </p>
                                        );
                                    })}
                                    {draft.pickedDates.length > 5 && (
                                        <p className="text-xs text-neutral-600">
                                            +{draft.pickedDates.length - 5} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowAvailability(true)}
                        className="mt-2 w-full text-left text-xs text-neutral-600 hover:text-white"
                    >
                        {availabilitySummary}
                    </button>
                </div>

                <div>
                    <p className="flex items-center gap-1 text-white font-bold mb-2">
                        Location <HelpCircle size={12} className="text-neutral-600" />
                    </p>
                    <button
                        type="button"
                        onClick={() => patch({ locationType: 'link' })}
                        className={`w-full flex items-center gap-2 py-2 text-left ${draft.locationType === 'link' ? 'text-white' : 'text-neutral-500'}`}
                    >
                        <Link2 size={16} /> Link
                    </button>
                    {draft.locationType === 'link' && (
                        <>
                            <input
                                value={draft.locationValue}
                                onChange={(e) => patch({ locationValue: e.target.value })}
                                placeholder="https://zoom.us/j/..."
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                            />
                            {draft.locationValue.trim().length > 4 && (
                                <LinkPreviewCard url={draft.locationValue} />
                            )}
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => patch({ locationType: 'phone' })}
                        className={`w-full flex items-center gap-2 py-2 text-left ${draft.locationType === 'phone' ? 'text-white' : 'text-neutral-500'}`}
                    >
                        <Phone size={16} /> Phone
                    </button>
                    {draft.locationType === 'phone' && (
                        <p className="text-xs text-neutral-500 pl-6">Recipients will provide their phone when booking.</p>
                    )}
                    <button
                        type="button"
                        onClick={() => patch({ locationType: 'in_person' })}
                        className={`w-full flex items-center gap-2 py-2 text-left ${draft.locationType === 'in_person' ? 'text-white' : 'text-neutral-500'}`}
                    >
                        <MapPin size={16} /> In person
                    </button>
                    {draft.locationType === 'in_person' && (
                        <AddressAutocomplete
                            value={draft.locationValue}
                            onChange={(v) => patch({ locationValue: v })}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => patch({ locationType: 'custom' })}
                        className={`w-full flex items-center gap-2 py-2 text-left ${draft.locationType === 'custom' ? 'text-white' : 'text-neutral-500'}`}
                    >
                        <AlignLeft size={16} /> Custom
                    </button>
                    {draft.locationType === 'custom' && (
                        <input
                            value={draft.locationValue}
                            onChange={(e) => patch({ locationValue: e.target.value })}
                            placeholder="Where"
                            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                        />
                    )}
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() => setShowBookingWindow((v) => !v)}
                        className="flex items-center justify-between w-full text-white font-bold mb-2"
                    >
                        Booking window
                        <ChevronRight
                            size={14}
                            className={`text-neutral-500 transition-transform ${showBookingWindow ? 'rotate-90' : ''}`}
                        />
                    </button>
                    <p className="text-xs text-neutral-500 mb-2">
                        {draft.bookingNoticeHours}h notice · {draft.bookingWindowDays} day max horizon
                    </p>
                    {showBookingWindow && (
                        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <label className="block space-y-1.5">
                                <span className="text-xs text-neutral-400">Minimum notice (hours)</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            patch({
                                                bookingNoticeHours: Math.max(
                                                    0,
                                                    draft.bookingNoticeHours - 1,
                                                ),
                                            })
                                        }
                                        className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold"
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min={0}
                                        max={168}
                                        value={draft.bookingNoticeHours}
                                        onChange={(e) =>
                                            patch({
                                                bookingNoticeHours: Math.max(
                                                    0,
                                                    parseInt(e.target.value, 10) || 0,
                                                ),
                                            })
                                        }
                                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm text-center"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            patch({
                                                bookingNoticeHours: Math.min(
                                                    168,
                                                    draft.bookingNoticeHours + 1,
                                                ),
                                            })
                                        }
                                        className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold"
                                    >
                                        +
                                    </button>
                                </div>
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs text-neutral-400">Maximum days ahead</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            patch({
                                                bookingWindowDays: Math.max(
                                                    1,
                                                    draft.bookingWindowDays - 1,
                                                ),
                                            })
                                        }
                                        className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold"
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={draft.bookingWindowDays}
                                        onChange={(e) =>
                                            patch({
                                                bookingWindowDays: Math.max(
                                                    1,
                                                    parseInt(e.target.value, 10) || 1,
                                                ),
                                            })
                                        }
                                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm text-center"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            patch({
                                                bookingWindowDays: Math.min(
                                                    365,
                                                    draft.bookingWindowDays + 1,
                                                ),
                                            })
                                        }
                                        className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold"
                                    >
                                        +
                                    </button>
                                </div>
                            </label>
                        </div>
                    )}
                </div>

                <textarea
                    value={draft.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="Any details to show on booking page"
                    rows={2}
                    className="w-full bg-transparent text-neutral-600 text-sm outline-none resize-none placeholder:text-neutral-700"
                />

                <button
                    type="button"
                    onClick={() => setShowGroupPicker(true)}
                    className="flex items-center gap-2 w-full text-left py-2 border border-white/10 rounded-xl px-3"
                >
                    {selectedGroup ? (
                        <>
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedGroup.color }} />
                            <span className="text-white text-sm font-bold">{selectedGroup.name}</span>
                        </>
                    ) : (
                        <span className="text-neutral-500 text-sm">Add to calendar group…</span>
                    )}
                </button>

                <div className="flex items-center gap-2 text-neutral-400">
                    <span className="w-8 h-8 rounded bg-red-600/20 flex items-center justify-center text-red-400 text-xs font-bold">
                        {hostEmail.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm">{hostEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-neutral-300">
                        Avoid conflicts <HelpCircle size={12} className="text-neutral-600" />
                    </span>
                    <NotionToggle checked={draft.avoidConflicts} onChange={(v) => patch({ avoidConflicts: v })} />
                </div>
                <p className="text-xs text-neutral-600 truncate">{hostEmail}</p>
            </div>

            <button type="button" onClick={onClose} className="sr-only">
                Close
            </button>
        </aside>
    );
}

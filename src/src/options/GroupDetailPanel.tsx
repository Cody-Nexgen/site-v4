import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { motion } from 'framer-motion';
import { MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { holidaysForRange } from '../lib/usHolidays';
import { recurrenceLabel } from '../lib/calendarRecurrence';
import type { CalendarEvent, CalendarGroup } from '../lib/schedulingTypes';
import { reducedMotion } from '../lib/motion';

type ListItem = {
    id: string;
    date: Date;
    title: string;
    timeLabel: string;
    event?: CalendarEvent;
};

const iconBtn =
    'flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]';
const menuItem =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-[var(--fz-text-2)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]';

function GroupListCard({
    title,
    timeLabel,
    color,
    past,
    onClick,
}: {
    title: string;
    timeLabel: string;
    color: string;
    past: boolean;
    onClick?: () => void;
}) {
    const cls = `cal-chip flex w-full overflow-hidden rounded-lg text-left transition-opacity ${past ? 'opacity-55 hover:opacity-80' : ''}`;
    const inner = (
        <>
            <span className="w-[3px] shrink-0" style={{ backgroundColor: color }} />
            <span className="min-w-0 flex-1 px-2.5 py-2">
                <span className="block truncate text-[13px] font-medium text-[var(--fz-text-1)]">{title}</span>
                <span className="mt-0.5 block truncate text-[11.5px] tabular-nums text-[var(--fz-text-3)]">{timeLabel}</span>
            </span>
        </>
    );
    const style = { '--ev': color } as CSSProperties;
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={cls} style={style}>
                {inner}
            </button>
        );
    }
    return (
        <div className={cls} style={style}>
            {inner}
        </div>
    );
}

export default function GroupDetailPanel({
    group,
    events,
    holidayRange,
    onClose,
    onEdit,
    onDeleteGroup,
    onAddEvent,
    onEditEvent,
    onDeleteEvent,
}: {
    group: CalendarGroup;
    events: CalendarEvent[];
    holidayRange: { start: Date; end: Date };
    onClose: () => void;
    onEdit: () => void;
    onDeleteGroup: () => void;
    onAddEvent: () => void;
    onEditEvent: (ev: CalendarEvent) => void;
    onDeleteEvent?: (ev: CalendarEvent) => void;
}) {
    const color = group.color;
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    const upcomingRef = useRef<HTMLDivElement>(null);
    const today = startOfDay(new Date());

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const items = useMemo((): ListItem[] => {
        if (group.kind === 'holidays') {
            return Object.entries(holidaysForRange(holidayRange.start, holidayRange.end))
                .map(([key, name]) => ({
                    id: key,
                    date: parseISO(key),
                    title: name,
                    timeLabel: 'All day',
                }))
                .sort((a, b) => a.date.getTime() - b.date.getTime());
        }
        return events
            .filter((e) => e.groupId === group.id)
            .map((e) => {
                const end = e.startHour * 60 + e.startMin + e.durationMin;
                const endH = Math.floor(end / 60) % 24;
                const endM = end % 60;
                const fmt = (h: number, m: number) => {
                    const ap = h >= 12 ? 'PM' : 'AM';
                    const hr = h % 12 || 12;
                    return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
                };
                return {
                    id: e.id,
                    date: new Date(e.date),
                    title: e.title,
                    timeLabel:
                        recurrenceLabel(e) ??
                        (e.allDay ? 'All day' : `${fmt(e.startHour, e.startMin)} – ${fmt(endH, endM)}`),
                    event: e,
                };
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [group, events, holidayRange]);

    const firstUpcoming = items.findIndex((it) => !isBefore(it.date, today));

    // Open on what's next rather than January.
    useEffect(() => {
        upcomingRef.current?.scrollIntoView({ block: 'start' });
    }, [group.id]);

    return (
        <motion.aside
            initial={reducedMotion.matches() ? false : { width: 0 }}
            animate={{ width: 300 }}
            exit={{ width: 0 }}
            transition={reducedMotion.safe({ duration: 0.28, ease: [0.16, 1, 0.3, 1] })}
            className="mr-4 flex h-full shrink-0 flex-col overflow-hidden rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] shadow-[var(--fz-elev-card)]"
        >
            <div className="flex w-[300px] shrink-0 items-center gap-2 pl-4 pr-2" style={{ height: 56 }}>
                <span className="size-3 shrink-0 rounded-[4px]" style={{ backgroundColor: color }} />
                <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--fz-text-1)]" title={group.name}>
                    {group.name}
                </h2>
                <div ref={moreRef} className="relative">
                    <button type="button" onClick={() => setMoreOpen((v) => !v)} className={iconBtn} aria-label="More options" title="More options">
                        <MoreHorizontal size={15} strokeWidth={1.75} />
                    </button>
                    {moreOpen && (
                        <div
                            className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1"
                            style={{ boxShadow: 'var(--fz-shadow-overlay)' }}
                        >
                            <button type="button" onClick={() => { setMoreOpen(false); onEdit(); }} className={menuItem}>
                                <Pencil size={13} strokeWidth={1.75} />
                                Edit calendar
                            </button>
                            {group.kind === 'custom' && (
                                <button type="button" onClick={() => { setMoreOpen(false); onAddEvent(); }} className={menuItem}>
                                    <Plus size={13} strokeWidth={1.75} />
                                    Add event
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { setMoreOpen(false); onDeleteGroup(); }}
                                className={`${menuItem} !text-[var(--fz-danger)] hover:!bg-[var(--fz-danger-soft)]`}
                            >
                                <Trash2 size={13} strokeWidth={1.75} />
                                Delete calendar
                            </button>
                        </div>
                    )}
                </div>
                <button type="button" onClick={onEdit} className={iconBtn} aria-label="Edit calendar" title="Edit">
                    <Pencil size={14} strokeWidth={1.75} />
                </button>
                <button type="button" onClick={onClose} className={iconBtn} aria-label="Close" title="Close">
                    <X size={15} strokeWidth={1.75} />
                </button>
            </div>

            <div className="w-[300px] flex-1 overflow-y-auto border-t border-[var(--fz-border)] px-3 pb-4 pt-3">
                {group.kind === 'custom' && (
                    <button
                        type="button"
                        onClick={onAddEvent}
                        className="mb-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--fz-border-strong)] text-[12.5px] font-medium text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                    >
                        <Plus size={14} strokeWidth={1.75} />
                        Add event
                    </button>
                )}
                {items.length === 0 ? (
                    <p className="px-1 py-6 text-center text-[12.5px] text-[var(--fz-text-4)]">Nothing in this calendar yet.</p>
                ) : (
                    <div className="space-y-3">
                        {items.map((item, index) => {
                            const dateKey = format(item.date, 'yyyy-MM-dd');
                            const previousDateKey = index > 0 ? format(items[index - 1].date, 'yyyy-MM-dd') : '';
                            const showDate = dateKey !== previousDateKey;
                            const past = isBefore(item.date, today);
                            return (
                                <div key={item.id} ref={index === firstUpcoming ? upcomingRef : undefined} className="scroll-mt-3">
                                    {showDate && (
                                        <p className={`mb-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.06em] ${past ? 'text-[var(--fz-text-4)]' : 'text-[var(--fz-text-3)]'}`}>
                                            {format(item.date, 'EEE, MMM d')}
                                        </p>
                                    )}
                                    <div className="group/item flex items-center gap-1">
                                        <div className="min-w-0 flex-1">
                                            <GroupListCard
                                                title={item.title}
                                                timeLabel={item.timeLabel}
                                                color={color}
                                                past={past}
                                                onClick={item.event ? () => onEditEvent(item.event!) : undefined}
                                            />
                                        </div>
                                        {item.event && onDeleteEvent && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Delete this event?')) {
                                                        onDeleteEvent(item.event!);
                                                    }
                                                }}
                                                className={`${iconBtn} opacity-0 hover:!text-[var(--fz-danger)] group-hover/item:opacity-100`}
                                                title="Delete event"
                                                aria-label="Delete event"
                                            >
                                                <Trash2 size={13} strokeWidth={1.75} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.aside>
    );
}

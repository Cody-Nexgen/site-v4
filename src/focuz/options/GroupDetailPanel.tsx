import { useMemo, useRef, useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { holidaysForRange } from '../lib/usHolidays';
import { eventCardFill } from '../lib/calendarUtils';
import { recurrenceLabel } from '../lib/calendarRecurrence';
import type { CalendarEvent, CalendarGroup } from '../lib/schedulingTypes';

type ListItem = {
    id: string;
    date: Date;
    title: string;
    timeLabel: string;
    event?: CalendarEvent;
};

function GroupListCard({
    title,
    timeLabel,
    color,
    onClick,
}: {
    title: string;
    timeLabel: string;
    color: string;
    onClick?: () => void;
}) {
    const inner = (
        <>
            <span className="w-1 shrink-0" style={{ backgroundColor: color }} />
            <span className="min-w-0 flex-1 px-3 py-2" style={{ backgroundColor: eventCardFill(color) }}>
                <span className="calendar-event-title block text-sm font-bold text-white">{title}</span>
                <span className="calendar-event-time mt-0.5 block text-xs text-neutral-400">{timeLabel}</span>
            </span>
        </>
    );
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="flex w-full overflow-hidden rounded-lg text-left transition-opacity hover:opacity-90"
            >
                {inner}
            </button>
        );
    }
    return <div className="flex w-full overflow-hidden rounded-lg">{inner}</div>;
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
                    timeLabel: 'All-day',
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
                    timeLabel: recurrenceLabel(e) ??
                        (e.allDay
                            ? 'All-day'
                            : `${fmt(e.startHour, e.startMin)} – ${fmt(endH, endM)}`),
                    event: e,
                };
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [group, events, holidayRange]);

    return (
        <motion.aside
            initial={{ width: 0 }}
            animate={{ width: 320 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#141414]"
        >
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="h-4 w-4 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-white">{group.name}</h2>
                <div ref={moreRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setMoreOpen((v) => !v)}
                        className="p-1 text-neutral-500 hover:text-white"
                        title="More options"
                    >
                        <MoreHorizontal size={16} />
                    </button>
                    {moreOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl py-1">
                            <button
                                type="button"
                                onClick={() => { setMoreOpen(false); onEdit(); }}
                                className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-white/[0.06] flex items-center gap-2"
                            >
                                <Pencil size={13} />
                                Edit group
                            </button>
                            <>
                                {group.kind === 'custom' && (
                                    <button
                                        type="button"
                                        onClick={() => { setMoreOpen(false); onAddEvent(); }}
                                        className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-white/[0.06] flex items-center gap-2"
                                    >
                                        <Plus size={13} />
                                        Add event
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setMoreOpen(false); onDeleteGroup(); }}
                                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                >
                                    <Trash2 size={13} />
                                    Delete group
                                </button>
                            </>
                        </div>
                    )}
                </div>
                <button type="button" onClick={onEdit} className="p-1 text-neutral-500 hover:text-white" title="Edit">
                    <Pencil size={16} />
                </button>
                <button type="button" onClick={onClose} className="p-1 text-neutral-500 hover:text-white">
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
                {group.kind === 'custom' && (
                    <button
                        type="button"
                        onClick={onAddEvent}
                        className="mb-4 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 py-2 text-xs font-bold text-neutral-400 hover:border-white/30 hover:text-white"
                    >
                        <Plus size={14} />
                        Add event
                    </button>
                )}
                <div className="space-y-4">
                    {items.map((item, index) => {
                        const dateKey = format(item.date, 'yyyy-MM-dd');
                        const previousDateKey =
                            index > 0 ? format(items[index - 1].date, 'yyyy-MM-dd') : '';
                        const showDate = dateKey !== previousDateKey;
                        return (
                            <div key={item.id}>
                                {showDate && (
                                    <p className="mb-2 text-xs font-medium text-neutral-500">
                                        {format(item.date, 'EEE MMM d')}
                                    </p>
                                )}
                                <div className="flex items-center gap-1 group/item">
                                    <div className="flex-1 min-w-0">
                                        <GroupListCard
                                            title={item.title}
                                            timeLabel={item.timeLabel}
                                            color={color}
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
                                            className="opacity-0 group-hover/item:opacity-100 p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all flex-shrink-0"
                                            title="Delete event"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.aside>
    );
}

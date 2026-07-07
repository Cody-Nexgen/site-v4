import { useMemo, useState } from 'react';
import {
    addDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { SchedulingLink } from '@/lib/scheduling/types';
import { slotsForDay, type BookedSlot } from '@/lib/scheduling/slots';

type Props = {
    link: SchedulingLink;
    booked: BookedSlot[];
    selectedDay: Date | null;
    selectedStartMin: number | null;
    onSelectDay: (day: Date | null) => void;
    onSelectTime: (startMin: number | null) => void;
};

export default function BookingScheduler({
    link,
    booked,
    selectedDay,
    selectedStartMin,
    onSelectDay,
    onSelectTime,
}: Props) {
    const [month, setMonth] = useState(() => selectedDay ?? new Date());

    const monthStart = startOfMonth(month);
    const gridDays = eachDayOfInterval({
        start: startOfWeek(monthStart),
        end: endOfWeek(endOfMonth(monthStart)),
    });

    const daySlots = selectedDay ? slotsForDay(link, selectedDay, booked) : [];

    const monthHasAvailability = useMemo(
        () => gridDays.some((d) => slotsForDay(link, d, booked).length > 0),
        [gridDays, link, booked],
    );

    return (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-3xl">
            <div className="shrink-0 w-full lg:w-[252px]">
                <h2 className="text-sm font-bold text-white mb-3">Select a date</h2>
                <div className="rounded-2xl border border-white/[0.08] bg-[#141418] p-3">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={() => setMonth((m) => addDays(startOfMonth(m), -1))}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"
                            aria-label="Previous month"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-bold">{format(month, 'MMMM yyyy')}</span>
                        <button
                            type="button"
                            onClick={() => setMonth((m) => addDays(endOfMonth(m), 1))}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"
                            aria-label="Next month"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-[9px] text-neutral-600 font-bold text-center mb-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <span key={`${d}-${i}`}>{d}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                        {gridDays.map((day) => {
                            const inMonth = isSameMonth(day, month);
                            const slots = slotsForDay(link, day, booked);
                            const hasSlots = slots.length > 0;
                            const sel = selectedDay && isSameDay(day, selectedDay);
                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    disabled={!hasSlots}
                                    onClick={() => {
                                        onSelectDay(day);
                                        onSelectTime(null);
                                    }}
                                    className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                                        !inMonth
                                            ? 'text-neutral-800'
                                            : hasSlots
                                              ? 'text-white hover:bg-white/10'
                                              : 'text-neutral-800 cursor-not-allowed'
                                    } ${sel ? 'bg-blue-600 text-white ring-2 ring-blue-400/40' : ''}`}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>
                    {!monthHasAvailability && (
                        <p className="mt-2 text-[11px] text-neutral-500 text-center">No open days this month</p>
                    )}
                </div>
            </div>

            <div className="flex-1 min-w-0 lg:max-w-[220px]">
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Clock size={14} className="text-neutral-500" />
                    {selectedDay ? format(selectedDay, 'EEE, MMM d') : 'Select a time'}
                </h2>

                {!selectedDay ? (
                    <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                        Pick a highlighted date to see available times.
                    </p>
                ) : daySlots.length === 0 ? (
                    <p className="text-sm text-neutral-500 rounded-xl border border-white/10 px-4 py-6 text-center">
                        No times left on this day.
                    </p>
                ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#141418] p-2 max-h-[min(320px,50vh)] overflow-y-auto">
                        <div className="flex flex-col gap-1">
                            {daySlots.map((slot) => {
                                const sel = selectedStartMin === slot.startMin;
                                return (
                                    <button
                                        key={slot.startMin}
                                        type="button"
                                        onClick={() => onSelectTime(slot.startMin)}
                                        className={`w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-left transition-all ${
                                            sel
                                                ? 'bg-blue-600 text-white'
                                                : 'text-neutral-200 hover:bg-white/[0.06]'
                                        }`}
                                    >
                                        {slot.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

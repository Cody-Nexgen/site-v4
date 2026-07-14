import { eachDayOfInterval, endOfWeek, format, isSameDay, isWeekend } from 'date-fns';
import type { CalendarEvent, CalendarGroup } from '../../lib/schedulingTypes';
import { eventCardFill } from '../../lib/calendarUtils';
import { colorForEvent } from '../../lib/eventColors';
import CalendarEventCard from '../CalendarEventCard';
import type { useCalendarGrid } from './useCalendarGrid';

type GridApi = ReturnType<typeof useCalendarGrid>;

type Chip = { label: string; color: string };

type Props = {
    weekStart: Date;
    interactive: boolean;
    today: Date;
    now: Date;
    hourHeight: number;
    gridHeight: number;
    grid: GridApi;
    groups: CalendarGroup[];
    timedEventsForDay: (day: Date) => CalendarEvent[];
    allDayChipsForDay: (day: Date) => Chip[];
    onRightPointerDown: (day: Date, dayIndex: number, clientY: number) => void;
    onDeleteEvent: (ev: CalendarEvent) => void;
    singleDayMode?: Date;
    onEventPointerDown?: (
        ev: CalendarEvent,
        day: Date,
        dayIndex: number,
        startMin: number,
        e: React.PointerEvent,
    ) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function CalendarWeekStrip({
    weekStart,
    interactive,
    today,
    now,
    hourHeight,
    gridHeight,
    grid,
    groups,
    timedEventsForDay,
    allDayChipsForDay,
    onRightPointerDown,
    onDeleteEvent,
    singleDayMode,
    onEventPointerDown,
}: Props) {
    const allWeekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });
    const weekDays = singleDayMode
        ? allWeekDays.filter((d) => isSameDay(d, singleDayMode))
        : allWeekDays;
    const maxAllDayRows = Math.max(1, ...weekDays.map((d) => allDayChipsForDay(d).length));
    const nowTopPx = (now.getHours() * 60 + now.getMinutes()) * (hourHeight / 60);
    const showNowLine = interactive && weekDays.some((d) => isSameDay(d, now));

    const dayCount = weekDays.length;
    const gridTemplate = `56px repeat(${dayCount}, 1fr)`;

    return (
        <div className="flex h-full min-h-0 flex-col" style={{ width: '33.333%', flexShrink: 0 }}>
            <div
                className="border-b flex-shrink-0"
                style={{
                    display: 'grid',
                    gridTemplateColumns: gridTemplate,
                    backgroundColor: 'var(--cal-surface)',
                    borderColor: 'var(--cal-border)',
                }}
            >
                <div className="border-r" style={{ borderColor: 'var(--cal-border)' }} />
                {weekDays.map((day) => {
                    const isToday = isSameDay(day, today);
                    const weekend = isWeekend(day);
                    return (
                        <div
                            key={day.toISOString()}
                            className="border-r py-3 px-1 text-center last:border-r-0"
                            style={{ borderColor: 'var(--cal-border)' }}
                        >
                            <div
                                className="text-xs font-semibold uppercase tracking-wide"
                                style={{ color: isToday ? 'var(--cal-accent)' : weekend ? 'var(--cal-hour)' : 'var(--cal-hour)' }}
                            >
                                {format(day, 'EEE')}
                            </div>
                            <div
                                className={`mt-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold ${
                                    isToday ? 'text-[#0c1220] shadow-md' : 'text-[var(--fz-text)]'
                                }`}
                                style={isToday ? { backgroundColor: 'var(--cal-today)' } : undefined}
                            >
                                {format(day, 'd')}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div
                className="sticky top-0 z-20 flex-shrink-0 border-b"
                style={{
                    minHeight: maxAllDayRows * 28 + 10,
                    display: 'grid',
                    gridTemplateColumns: gridTemplate,
                    backgroundColor: 'var(--cal-surface)',
                    borderColor: 'var(--cal-border)',
                }}
            >
                <div className="flex items-start justify-end border-r pr-2 pt-1.5" style={{ borderColor: 'var(--cal-border)' }}>
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--cal-hour)' }}>
                        All day
                    </span>
                </div>
                {weekDays.map((day) => {
                    const chips = allDayChipsForDay(day);
                    return (
                        <div
                            key={`allday-${day.toISOString()}`}
                            className="space-y-0.5 border-r p-1 last:border-r-0"
                            style={{ borderColor: 'var(--cal-border)' }}
                        >
                            {chips.length === 0 ? (
                                <div className="h-5" />
                            ) : (
                                chips.map((chip, i) => (
                                    <div
                                        key={`${chip.label}-${i}`}
                                        className="flex overflow-hidden text-[9px] font-semibold truncate shadow-sm"
                                        style={{ borderRadius: '10px' }}
                                    >
                                        <span className="w-1 shrink-0" style={{ backgroundColor: chip.color }} />
                                        <span
                                            className="min-w-0 flex-1 truncate px-1.5 py-0.5 text-white"
                                            style={{ backgroundColor: eventCardFill(chip.color) }}
                                        >
                                            {chip.label}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    );
                })}
            </div>

            <div
                ref={interactive ? grid.gridScrollRef : undefined}
                className="relative min-h-0 flex-1 overflow-hidden"
            >
                <div
                    className="relative"
                    style={{ height: gridHeight, display: 'grid', gridTemplateColumns: gridTemplate }}
                >
                    <div className="relative border-r" style={{ borderColor: 'var(--cal-border)' }}>
                        {HOURS.map((h) => (
                            <div key={h} className="relative" style={{ height: hourHeight }}>
                                <span
                                    className="absolute top-0 right-2 -translate-y-1/2 text-[11px] font-normal"
                                    style={{ color: 'var(--cal-hour)' }}
                                >
                                    {h === 0
                                        ? '12 AM'
                                        : h < 12
                                          ? `${h} AM`
                                          : h === 12
                                            ? '12 PM'
                                            : `${h - 12} PM`}
                                </span>
                            </div>
                        ))}
                    </div>

                    {weekDays.map((day, dayIndex) => {
                        const dayEvents = timedEventsForDay(day);
                        return (
                            <div
                                key={day.toISOString()}
                                ref={
                                    interactive
                                        ? (el) => {
                                              grid.columnRefs.current[dayIndex] = el;
                                          }
                                        : undefined
                                }
                                className="relative border-r last:border-r-0 select-none"
                                style={{
                                    height: gridHeight,
                                    backgroundColor: 'var(--cal-bg)',
                                    borderColor: 'var(--cal-border)',
                                }}
                                onContextMenu={
                                    interactive
                                        ? (e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                          }
                                        : undefined
                                }
                                onMouseDown={
                                    interactive
                                        ? (e) => {
                                              if (e.button === 2) e.preventDefault();
                                          }
                                        : undefined
                                }
                                onPointerDown={
                                    interactive
                                        ? (e) => {
                                              if (e.button !== 0 && e.button !== 2) return;
                                              e.preventDefault();
                                              e.stopPropagation();
                                              onRightPointerDown(day, dayIndex, e.clientY);
                                          }
                                        : undefined
                                }
                            >
                                {HOURS.map((h) => (
                                    <div
                                        key={h}
                                        className="border-t"
                                        style={{ height: hourHeight, borderColor: 'var(--cal-border)' }}
                                    />
                                ))}
                                {interactive && grid.dragSelect?.dayIndex === dayIndex && (
                                    <div
                                        className="pointer-events-none absolute left-0.5 right-0.5 z-[2] rounded-xl border-2"
                                        style={{
                                            borderColor: 'var(--cal-accent)',
                                            backgroundColor: 'var(--cal-accent-muted)',
                                            top: grid.yFromMinutes(
                                                Math.min(
                                                    grid.dragSelect.startMin,
                                                    grid.dragSelect.endMin,
                                                ),
                                            ),
                                            height: Math.max(
                                                hourHeight / 4,
                                                grid.yFromMinutes(
                                                    Math.abs(
                                                        grid.dragSelect.endMin -
                                                            grid.dragSelect.startMin,
                                                    ) || 15,
                                                ),
                                            ),
                                        }}
                                    />
                                )}
                                {dayEvents.map((ev) => {
                                    const startMin = ev.startHour * 60 + ev.startMin;
                                    const topPx = grid.yFromMinutes(startMin);
                                    const heightPx = Math.max(
                                        hourHeight / 4,
                                        grid.yFromMinutes(ev.durationMin),
                                    );
                                    const displayColor = colorForEvent(ev, groups);
                                    return (
                                        <CalendarEventCard
                                            key={ev.id}
                                            ev={ev}
                                            color={displayColor}
                                            top={topPx}
                                            height={heightPx}
                                            onDelete={() => onDeleteEvent(ev)}
                                            onPointerDown={
                                                interactive && onEventPointerDown
                                                    ? (e) => {
                                                          if (e.button !== 0) return;
                                                          e.stopPropagation();
                                                          onEventPointerDown(ev, day, dayIndex, startMin, e);
                                                      }
                                                    : undefined
                                            }
                                        />
                                    );
                                })}
                            </div>
                        );
                    })}

                    {showNowLine && (
                        <div
                            className="pointer-events-none absolute left-0 right-0 z-[10] flex items-center"
                            style={{ top: nowTopPx }}
                        >
                            <span
                                className="w-[56px] flex-shrink-0 pr-2 text-right text-[10px] font-semibold -translate-y-1/2"
                                style={{ color: 'var(--cal-now)', backgroundColor: 'var(--cal-bg)' }}
                            >
                                {format(now, 'h:mm a')}
                            </span>
                            <div
                                className="h-[2px] flex-1"
                                style={{
                                    backgroundColor: 'var(--cal-now)',
                                    boxShadow: '0 0 8px rgba(245, 158, 11, 0.45)',
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

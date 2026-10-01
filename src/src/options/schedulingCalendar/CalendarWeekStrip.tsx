import type { CSSProperties } from 'react';
import { addDays, eachDayOfInterval, endOfWeek, format, isBefore, isSameDay } from 'date-fns';
import type { CalendarEvent, CalendarGroup } from '../../lib/schedulingTypes';
import { sameSeriesSlot } from '../../lib/calendarRecurrence';
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
    onEmptyDoubleClick?: (day: Date, dayIndex: number, clientY: number) => void;
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

/** Sticky day-header height; the all-day row sticks right under it. */
export const CAL_HEADER_HEIGHT = 58;
const GUTTER = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number): string {
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function timeZoneShort(d: Date): string {
    try {
        return new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
            .formatToParts(d)
            .find((p) => p.type === 'timeZoneName')?.value ?? '';
    } catch {
        return '';
    }
}

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
    onEmptyDoubleClick,
    onDeleteEvent,
    singleDayMode,
    onEventPointerDown,
}: Props) {
    const allWeekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });
    const weekDays = singleDayMode ? allWeekDays.filter((d) => isSameDay(d, singleDayMode)) : allWeekDays;
    const maxAllDayRows = Math.max(0, ...weekDays.map((d) => allDayChipsForDay(d).length));
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowTopPx = nowMin * (hourHeight / 60);
    const todayIndex = weekDays.findIndex((d) => isSameDay(d, now));
    const showNowLine = interactive && todayIndex >= 0;
    const nowMs = now.getTime();

    const dayCount = weekDays.length;
    const gridTemplate = `${GUTTER}px repeat(${dayCount}, minmax(0, 1fr))`;
    // Calm grid: hour hairlines only (no half-hour stripes, no column fills).
    const hairline = 'var(--fz-border)';
    const hourLines: CSSProperties = {
        backgroundImage: `linear-gradient(to bottom, ${hairline} 1px, transparent 1px)`,
        backgroundSize: `100% ${hourHeight}px`,
    };

    return (
        <div className="flex flex-col" style={{ width: '33.333%', flexShrink: 0 }}>
            {/* Day header */}
            <div
                className="sticky top-0 z-[25] grid border-b border-[var(--fz-border)] bg-[var(--fz-bg-raised)]"
                style={{ gridTemplateColumns: gridTemplate, height: CAL_HEADER_HEIGHT }}
            >
                <div className="flex items-end justify-end pb-1.5 pr-2 text-[10px] font-medium text-[var(--fz-text-4)]">
                    {timeZoneShort(now)}
                </div>
                {weekDays.map((day) => {
                    const isToday = isSameDay(day, today);
                    const isPast = !isToday && isBefore(day, today);
                    return (
                        <div
                            key={day.toISOString()}
                            className={`flex flex-col justify-center gap-0.5 ${singleDayMode ? 'items-start pl-3' : 'items-center'}`}
                        >
                            <span
                                className={`text-[10.5px] font-medium uppercase tracking-[0.08em] ${
                                    isToday ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-4)]'
                                }`}
                            >
                                {format(day, singleDayMode ? 'EEEE' : 'EEE')}
                            </span>
                            <span
                                className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[17px] font-medium tabular-nums leading-none ${
                                    isToday
                                        ? 'bg-[var(--fz-accent)] text-[var(--fz-accent-fg)]'
                                        : isPast
                                          ? 'text-[var(--fz-text-3)]'
                                          : 'text-[var(--fz-text-1)]'
                                }`}
                            >
                                {format(day, 'd')}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* All-day row */}
            <div
                className="sticky z-[24] grid border-b border-[var(--fz-border)] bg-[var(--fz-bg-raised)]"
                style={{ top: CAL_HEADER_HEIGHT, gridTemplateColumns: gridTemplate, minHeight: maxAllDayRows ? maxAllDayRows * 24 + 8 : 26 }}
            >
                <div className="flex items-center justify-end pr-2 text-[10px] font-medium text-[var(--fz-text-4)]">
                    All day
                </div>
                {weekDays.map((day) => {
                    const chips = allDayChipsForDay(day);
                    return (
                        <div key={`allday-${day.toISOString()}`} className="min-w-0 space-y-1 border-l px-1 py-1" style={{ borderColor: hairline }}>
                            {chips.map((chip, i) => (
                                <div
                                    key={`${chip.label}-${i}`}
                                    className="cal-chip flex h-5 items-center gap-1.5 overflow-hidden rounded-md pr-2"
                                    style={{ '--ev': chip.color } as CSSProperties}
                                    title={chip.label}
                                >
                                    <span className="h-full w-[3px] shrink-0" style={{ backgroundColor: chip.color }} />
                                    <span className="truncate text-[11.5px] font-medium text-[var(--fz-text-1)]">{chip.label}</span>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* Time grid */}
            <div ref={interactive ? grid.gridScrollRef : undefined} className="relative">
                <div className="relative grid" style={{ height: gridHeight, gridTemplateColumns: gridTemplate }}>
                    <div className="relative">
                        {HOURS.slice(1).map((h) => {
                            const y = h * hourHeight;
                            // The current-time label takes this spot when it's close.
                            const nearNow = showNowLine && Math.abs(y - nowTopPx) < 14;
                            return (
                                <span
                                    key={h}
                                    className="absolute right-2.5 -translate-y-1/2 text-[10.5px] tabular-nums text-[var(--fz-text-4)]"
                                    style={{ top: y, visibility: nearNow ? 'hidden' : undefined }}
                                >
                                    {hourLabel(h)}
                                </span>
                            );
                        })}
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
                                className="relative select-none border-l"
                                style={{ height: gridHeight, borderColor: hairline, ...hourLines }}
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
                                              // Don't preventDefault on left click — that kills double-click create.
                                              if (e.button === 2) e.preventDefault();
                                              e.stopPropagation();
                                              onRightPointerDown(day, dayIndex, e.clientY);
                                          }
                                        : undefined
                                }
                                onDoubleClick={
                                    interactive && onEmptyDoubleClick
                                        ? (e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              onEmptyDoubleClick(day, dayIndex, e.clientY);
                                          }
                                        : undefined
                                }
                            >
                                {interactive && grid.dragSelect?.dayIndex === dayIndex && (
                                    <div
                                        className="pointer-events-none absolute left-1 right-1.5 z-[2] rounded-md border border-[var(--fz-border-strong)] bg-[var(--fz-accent-soft)]"
                                        style={{
                                            top: grid.yFromMinutes(Math.min(grid.dragSelect.startMin, grid.dragSelect.endMin)),
                                            height: Math.max(
                                                hourHeight / 4,
                                                grid.yFromMinutes(Math.abs(grid.dragSelect.endMin - grid.dragSelect.startMin) || 15),
                                            ),
                                        }}
                                    />
                                )}
                                {dayEvents.map((ev) => {
                                    const startMin = ev.startHour * 60 + ev.startMin;
                                    const topPx = grid.yFromMinutes(startMin);
                                    const heightPx = Math.max(hourHeight / 4, grid.yFromMinutes(ev.durationMin));
                                    const endMs = new Date(day).setHours(0, startMin + ev.durationMin, 0, 0);
                                    const displayColor = colorForEvent(ev, groups);
                                    const connectedLeft =
                                        dayIndex > 0 &&
                                        timedEventsForDay(addDays(day, -1)).some((other) => sameSeriesSlot(ev, other));
                                    const connectedRight =
                                        dayIndex < weekDays.length - 1 &&
                                        timedEventsForDay(addDays(day, 1)).some((other) => sameSeriesSlot(ev, other));
                                    return (
                                        <CalendarEventCard
                                            key={ev.id}
                                            ev={ev}
                                            color={displayColor}
                                            top={topPx}
                                            height={heightPx}
                                            past={endMs < nowMs}
                                            connectedLeft={connectedLeft}
                                            connectedRight={connectedRight}
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

                    {/* Current time: one even line across the whole week (under events), a dot where it
                        starts, and the time in the gutter. */}
                    {showNowLine && (
                        <div
                            className="pointer-events-none absolute right-0 z-[3]"
                            // Whole-pixel top keeps the 1px line crisp instead of a blurry 2px smear.
                            style={{ top: Math.round(nowTopPx), left: GUTTER }}
                        >
                            <span className="absolute -left-[3.5px] top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-[var(--fz-danger)]" />
                            <div className="h-px bg-[var(--fz-danger)]" />
                            <span
                                className="absolute top-1/2 -translate-y-1/2 text-[10.5px] font-semibold tabular-nums text-[var(--fz-danger)]"
                                style={{ right: 'calc(100% + 10px)' }}
                            >
                                {format(now, 'h:mm')}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

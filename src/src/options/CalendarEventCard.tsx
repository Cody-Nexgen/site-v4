import type { CSSProperties, PointerEvent } from 'react';
import type { CalendarEvent } from '../lib/schedulingTypes';
import { eventTimeLabel } from '../lib/calendarUtils';

/** Below this height, title and start time share one line. */
const RANGE_TIME_MIN_HEIGHT = 36;
/** Below this height, there isn't room for a time at all. */
const ANY_TIME_MIN_HEIGHT = 18;
/** Above this height there's room to breathe a little. */
const TALL_MIN_HEIGHT = 60;

/** "10a", "10:30a" — short enough to leave the title room in narrow columns. */
function compactTime(totalMin: number): string {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`;
}

/**
 * Timed event block. The event's own color is kept (it carries meaning) but
 * muted into the monochrome UI: a tint of it over the panel (`.cal-event`), a
 * slim accent bar, and fz text colors that read in both themes.
 */
export default function CalendarEventCard({
    ev,
    color,
    top,
    height,
    past = false,
    onPointerDown,
    onPointerUp,
    onDelete,
    connectedLeft = false,
    connectedRight = false,
}: {
    ev: CalendarEvent;
    color: string;
    top: number;
    height: number;
    /** Already ended — rendered quieter. */
    past?: boolean;
    onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp?: (e: PointerEvent<HTMLButtonElement>) => void;
    onDelete?: () => void;
    connectedLeft?: boolean;
    connectedRight?: boolean;
}) {
    const h = Math.max(height, 18);
    const showTime = !ev.allDay && h >= ANY_TIME_MIN_HEIGHT;
    const stacked = h >= RANGE_TIME_MIN_HEIGHT;
    const isTall = h >= TALL_MIN_HEIGHT;
    const startLabel = compactTime(ev.startHour * 60 + ev.startMin);
    const radius = 'var(--cal-event-radius, 6px)';

    return (
        <button
            type="button"
            title={`${ev.title} · ${ev.allDay ? 'All day' : eventTimeLabel(ev)}`}
            onPointerDown={(e) => {
                if (e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                onPointerDown?.(e);
            }}
            onPointerUp={onPointerUp}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete?.();
            }}
            onClick={(e) => e.preventDefault()}
            data-past={past || undefined}
            className="cal-event absolute z-[4] flex overflow-hidden text-left touch-none select-none"
            style={
                {
                    '--ev': color,
                    top: top + 1,
                    height: h - 2,
                    left: connectedLeft ? -1 : 3,
                    right: connectedRight ? -1 : 5,
                    borderTopLeftRadius: connectedLeft ? 0 : radius,
                    borderBottomLeftRadius: connectedLeft ? 0 : radius,
                    borderTopRightRadius: connectedRight ? 0 : radius,
                    borderBottomRightRadius: connectedRight ? 0 : radius,
                } as CSSProperties
            }
        >
            {!connectedLeft && <span className="w-[3px] shrink-0" style={{ backgroundColor: color }} />}
            {stacked ? (
                <span className={`flex min-w-0 flex-1 flex-col px-1.5 ${isTall ? 'gap-0.5 py-1.5' : 'py-1'}`}>
                    <span className={`truncate font-semibold leading-tight text-[var(--fz-text-1)] ${isTall ? 'text-[12.5px]' : 'text-[12px]'}`}>
                        {ev.title}
                    </span>
                    {showTime && (
                        <span className="cal-event-time truncate text-[11px] font-medium leading-snug tabular-nums">
                            {eventTimeLabel(ev)}
                        </span>
                    )}
                </span>
            ) : (
                <span className="flex min-w-0 flex-1 items-center gap-1 px-1.5 text-[11.5px] leading-none">
                    <span className="truncate font-semibold text-[var(--fz-text-1)]">{ev.title}</span>
                    {showTime && <span className="cal-event-time shrink-0 font-medium tabular-nums">{startLabel}</span>}
                </span>
            )}
        </button>
    );
}

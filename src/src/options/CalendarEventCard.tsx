import type { PointerEvent } from 'react';
import type { CalendarEvent } from '../lib/schedulingTypes';
import { eventCardFill, eventTimeLabel, formatMinutes } from '../lib/calendarUtils';

/** Below this height, only the start time fits comfortably. */
const RANGE_TIME_MIN_HEIGHT = 36;
/** Below this height, there isn't room for a time line at all. */
const ANY_TIME_MIN_HEIGHT = 22;
/** Above this height there's enough room to bump typography up a notch. */
const TALL_MIN_HEIGHT = 60;

function compactTimeLabel(ev: CalendarEvent): string {
    if (ev.allDay) return 'All day';
    return formatMinutes(ev.startHour * 60 + ev.startMin);
}

export default function CalendarEventCard({
    ev,
    color,
    top,
    height,
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
    onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp?: (e: PointerEvent<HTMLButtonElement>) => void;
    onDelete?: () => void;
    connectedLeft?: boolean;
    connectedRight?: boolean;
}) {
    const h = Math.max(height, 20);
    const showTime = !ev.allDay && h >= ANY_TIME_MIN_HEIGHT;
    const showFullRange = h >= RANGE_TIME_MIN_HEIGHT;
    const isTall = h >= TALL_MIN_HEIGHT;
    const timeText = showFullRange ? eventTimeLabel(ev) : compactTimeLabel(ev);

    const titleSizeClass = isTall ? 'text-[12px]' : showFullRange ? 'text-[11px]' : 'text-[10px]';
    const timeSizeClass = isTall ? 'text-[11px]' : showFullRange ? 'text-[10px]' : 'text-[9px]';

    return (
        <button
            type="button"
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
            className="absolute z-[4] flex overflow-hidden text-left touch-none select-none"
            style={{
                top,
                height: h,
                left: connectedLeft ? -1 : 2,
                right: connectedRight ? -1 : 2,
                borderTopLeftRadius: connectedLeft ? 0 : 'var(--cal-event-radius, 6px)',
                borderBottomLeftRadius: connectedLeft ? 0 : 'var(--cal-event-radius, 6px)',
                borderTopRightRadius: connectedRight ? 0 : 'var(--cal-event-radius, 6px)',
                borderBottomRightRadius: connectedRight ? 0 : 'var(--cal-event-radius, 6px)',
            }}
        >
            {!connectedLeft && <span className="w-1 shrink-0" style={{ backgroundColor: color }} />}
            <span
                className={`flex min-w-0 flex-1 flex-col justify-start px-1.5 ${
                    isTall ? 'py-1.5 gap-1' : showFullRange ? 'py-1 gap-0.5' : 'py-0.5'
                }`}
                style={{ backgroundColor: eventCardFill(color) }}
            >
                <span className={`calendar-event-title truncate font-bold leading-tight text-white ${titleSizeClass}`}>
                    {ev.title}
                </span>
                {showTime && (
                    <span
                        className={`calendar-event-time truncate font-medium leading-snug tabular-nums text-white/75 ${timeSizeClass}`}
                    >
                        {timeText}
                    </span>
                )}
            </span>
        </button>
    );
}

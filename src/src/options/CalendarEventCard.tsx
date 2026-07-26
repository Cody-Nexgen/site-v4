import type { PointerEvent } from 'react';
import type { CalendarEvent } from '../lib/schedulingTypes';
import { eventCardFill, eventTimeLabel } from '../lib/calendarUtils';

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
    const showTime = !ev.allDay && h >= 22;

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
                className="flex min-w-0 flex-1 flex-col justify-start px-1.5 py-0.5"
                style={{ backgroundColor: eventCardFill(color) }}
            >
                <span className="calendar-event-title truncate text-[10px] font-bold leading-tight text-white">{ev.title}</span>
                {showTime && (
                    <span className="calendar-event-time truncate text-[9px] font-medium leading-snug text-white/70">
                        {eventTimeLabel(ev)}
                    </span>
                )}
            </span>
        </button>
    );
}

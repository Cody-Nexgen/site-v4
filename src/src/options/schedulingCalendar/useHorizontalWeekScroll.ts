import { useEffect, useRef } from 'react';
import { addWeeks, subWeeks } from 'date-fns';

const WHEEL_THRESHOLD = 72;

/** Shift + wheel changes the visible week (and mini-calendar highlight via setWeekStart). */
export function useHorizontalWeekScroll(
    setWeekStart: (d: Date | ((prev: Date) => Date)) => void,
    onWeekChange?: (weekStart: Date) => void,
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const accumRef = useRef(0);
    const cooldownRef = useRef(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            if (!e.shiftKey) return;
            e.preventDefault();

            const now = Date.now();
            if (now - cooldownRef.current < 280) return;

            accumRef.current += e.deltaY;
            if (Math.abs(accumRef.current) < WHEEL_THRESHOLD) return;

            const forward = accumRef.current > 0;
            accumRef.current = 0;
            cooldownRef.current = now;

            setWeekStart((ws) => {
                const next = forward ? addWeeks(ws, 1) : subWeeks(ws, 1);
                onWeekChange?.(next);
                return next;
            });
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [setWeekStart, onWeekChange]);

    return { containerRef };
}

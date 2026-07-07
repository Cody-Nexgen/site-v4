import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { addWeeks, startOfWeek, subWeeks } from 'date-fns';

const WHEEL_THRESHOLD = 8;
const WHEEL_IDLE_MS = 80;

/** Shift+wheel jumps week instantly — no slide offset, no animations. */
export function useSmoothWeekCarousel(
    weekStart: Date,
    setWeekStart: (d: Date | ((prev: Date) => Date)) => void,
    onWeekChange?: (ws: Date) => void,
) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const accumRef = useRef(0);
    const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const prevWeek = subWeeks(weekStart, 1);
    const nextWeek = addWeeks(weekStart, 1);
    const weeks = [prevWeek, weekStart, nextWeek] as const;

    const commitWeek = useCallback(
        (direction: 1 | -1) => {
            setWeekStart((ws) => {
                const next = direction > 0 ? addWeeks(ws, 1) : subWeeks(ws, 1);
                const normalized = startOfWeek(next);
                onWeekChange?.(normalized);
                return normalized;
            });
        },
        [setWeekStart, onWeekChange],
    );

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const flush = () => {
            idleRef.current = null;
            const acc = accumRef.current;
            accumRef.current = 0;
            if (acc > WHEEL_THRESHOLD) commitWeek(1);
            else if (acc < -WHEEL_THRESHOLD) commitWeek(-1);
        };

        const onWheel = (e: WheelEvent) => {
            if (!e.shiftKey) return;
            e.preventDefault();
            e.stopPropagation();
            // Use whichever axis has more movement (horizontal scroll on trackpads uses deltaX)
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            accumRef.current += delta;
            if (idleRef.current) clearTimeout(idleRef.current);
            idleRef.current = setTimeout(flush, WHEEL_IDLE_MS);
        };

        el.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => {
            el.removeEventListener('wheel', onWheel, { capture: true });
            if (idleRef.current) clearTimeout(idleRef.current);
        };
    }, [commitWeek]);

    const slideStyle: CSSProperties = {
        display: 'flex',
        width: '300%',
        height: '100%',
        transform: 'translateX(-33.333%)',
    };

    return { viewportRef, weeks, slideStyle, commitWeek };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarEvent } from '../../lib/schedulingTypes';
import { HOURS_PER_DAY, minutesFromY, snapMinutes, yFromMinutes } from '../../lib/calendarUtils';

export type DragSelect = {
    day: Date;
    dayIndex: number;
    startMin: number;
    endMin: number;
} | null;

export type DragEventState = {
    eventId: string;
    pointerId: number;
    originDayIndex: number;
    originStartMin: number;
    grabOffsetMin: number;
} | null;

export function useCalendarGrid() {
    const gridScrollRef = useRef<HTMLDivElement>(null);
    const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [hourHeight, setHourHeight] = useState(48);
    const [dragSelect, setDragSelect] = useState<DragSelect>(null);
    const dragEventRef = useRef<DragEventState>(null);
    const [, bump] = useState(0);

    const gridHeight = hourHeight * HOURS_PER_DAY;

    useEffect(() => {
        const el = gridScrollRef.current;
        if (!el) return;
        const measure = () => {
            const h = el.clientHeight;
            if (h > 24) setHourHeight(h / HOURS_PER_DAY);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const minFromClientY = useCallback(
        (dayIndex: number, clientY: number) => {
            const col = columnRefs.current[dayIndex];
            if (!col) return 0;
            const rect = col.getBoundingClientRect();
            return minutesFromY(clientY - rect.top, hourHeight);
        },
        [hourHeight],
    );

    const dayIndexFromClientX = useCallback((clientX: number) => {
        for (let i = 0; i < columnRefs.current.length; i += 1) {
            const col = columnRefs.current[i];
            if (!col) continue;
            const r = col.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right) return i;
        }
        return -1;
    }, []);

    const startDragSelect = (day: Date, dayIndex: number, clientY: number) => {
        const m = minFromClientY(dayIndex, clientY);
        setDragSelect({ day, dayIndex, startMin: m, endMin: m + 15 });
    };

    const updateDragSelect = (dayIndex: number, clientY: number, day?: Date) => {
        setDragSelect((prev) => {
            if (!prev) return prev;
            const m = minFromClientY(dayIndex, clientY);
            return { ...prev, dayIndex, day: day ?? prev.day, endMin: m };
        });
    };

    const startDragEvent = (
        ev: CalendarEvent,
        dayIndex: number,
        clientY: number,
        pointerId: number,
    ) => {
        const startMin = ev.startHour * 60 + ev.startMin;
        const grab = minFromClientY(dayIndex, clientY) - startMin;
        dragEventRef.current = {
            eventId: ev.id,
            pointerId,
            originDayIndex: dayIndex,
            originStartMin: startMin,
            grabOffsetMin: grab,
        };
        bump((n) => n + 1);
    };

    const moveDragEvent = (clientX: number, clientY: number) => {
        const drag = dragEventRef.current;
        if (!drag) return null;
        const dayIndex = dayIndexFromClientX(clientX);
        if (dayIndex < 0) return null;
        const raw = minFromClientY(dayIndex, clientY) - drag.grabOffsetMin;
        const startMin = snapMinutes(Math.max(0, Math.min(HOURS_PER_DAY * 60 - 15, raw)));
        return { dayIndex, startMin, eventId: drag.eventId };
    };

    const endDragEvent = () => {
        const drag = dragEventRef.current;
        dragEventRef.current = null;
        bump((n) => n + 1);
        return drag;
    };

    const isDraggingEvent = (id: string) => dragEventRef.current?.eventId === id;

    return {
        gridScrollRef,
        columnRefs,
        hourHeight,
        gridHeight,
        dragSelect,
        setDragSelect,
        dragEventRef,
        isDraggingEvent,
        yFromMinutes: (m: number) => yFromMinutes(m, hourHeight),
        startDragSelect,
        updateDragSelect,
        startDragEvent,
        moveDragEvent,
        endDragEvent,
        dayIndexFromClientX,
        minFromClientY,
    };
};

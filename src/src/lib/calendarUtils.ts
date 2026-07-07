import type { CalendarEvent } from './schedulingTypes';

export const SNAP_MINUTES = 15;
export const HOURS_PER_DAY = 24;

/** Solid preset colors only (no alpha in picker). */
export const EVENT_COLOR_PRESETS = [
    '#38bdf8',
    '#6366f1',
    '#a855f7',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
] as const;

const HOLIDAY_PALETTE = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#6366f1',
    '#a855f7',
    '#ec4899',
    '#06b6d4',
];

export function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h << 5) - h + s.charCodeAt(i);
    return Math.abs(h);
}

/** Same holiday name → same color every refresh. */
export function colorForHoliday(name: string): string {
    return HOLIDAY_PALETTE[hashString(name) % HOLIDAY_PALETTE.length];
}

export function randomEventColor(): string {
    return EVENT_COLOR_PRESETS[Math.floor(Math.random() * EVENT_COLOR_PRESETS.length)];
}

export function snapMinutes(totalMin: number): number {
    return Math.round(totalMin / SNAP_MINUTES) * SNAP_MINUTES;
}

export function minutesFromY(y: number, hourHeight: number): number {
    const raw = (y / hourHeight) * 60;
    return Math.max(0, Math.min(HOURS_PER_DAY * 60 - SNAP_MINUTES, snapMinutes(raw)));
}

export function yFromMinutes(totalMin: number, hourHeight: number): number {
    return (totalMin / 60) * hourHeight;
}

export function eventEndMinutes(ev: Pick<CalendarEvent, 'startHour' | 'startMin' | 'durationMin'>): number {
    return ev.startHour * 60 + ev.startMin + ev.durationMin;
}

export function durationFromRange(startMin: number, endMin: number): number {
    return Math.max(SNAP_MINUTES, endMin - startMin);
}

export function rangeLabel(startMin: number, endMin: number): string {
    return `${formatMinutes(startMin)} – ${formatMinutes(endMin)}`;
}

export function formatMinutes(totalMin: number): string {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
}

export function eventTimeLabel(ev: CalendarEvent): string {
    if (ev.allDay) return 'All day';
    const start = ev.startHour * 60 + ev.startMin;
    const end = eventEndMinutes(ev);
    return rangeLabel(start, end);
}

export type TimeOption = { value: number; label: string };

export function buildTimeOptions(): TimeOption[] {
    const out: TimeOption[] = [];
    for (let t = 0; t < HOURS_PER_DAY * 60; t += SNAP_MINUTES) {
        out.push({ value: t, label: formatMinutes(t) });
    }
    return out;
}

export const TIME_OPTIONS = buildTimeOptions();

/** Card fill uses lowered opacity; stripe stays solid. */
export function eventCardFill(hex: string, alpha = 0.22): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return `color-mix(in srgb, ${hex} 22%, transparent)`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

export function normalizeHexColor(input: string, fallback = '#6366f1'): string {
    const v = input.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
        const c = v.slice(1);
        return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toLowerCase();
    }
    return fallback;
}

export type WeekHighlightRect = { row: number; colStart: number; colSpan: number };

/** Contiguous row segments for current week in mini-month grid. */
export function weekHighlightSegments(
    miniDays: Date[],
    weekDays: Date[],
): WeekHighlightRect[] {
    const indices: number[] = [];
    miniDays.forEach((d, i) => {
        if (weekDays.some((w) => w.toDateString() === d.toDateString())) indices.push(i);
    });
    if (indices.length === 0) return [];

    const segments: WeekHighlightRect[] = [];
    let runStart = indices[0];
    let prev = indices[0];

    const flush = (start: number, end: number) => {
        const row = Math.floor(start / 7);
        const endRow = Math.floor(end / 7);
        if (row === endRow) {
            segments.push({
                row,
                colStart: start % 7,
                colSpan: end - start + 1,
            });
        } else {
            segments.push({ row, colStart: start % 7, colSpan: 7 - (start % 7) });
            for (let r = row + 1; r < endRow; r += 1) {
                segments.push({ row: r, colStart: 0, colSpan: 7 });
            }
            segments.push({ row: endRow, colStart: 0, colSpan: (end % 7) + 1 });
        }
    };

    for (let i = 1; i < indices.length; i += 1) {
        const idx = indices[i];
        const prevRow = Math.floor(prev / 7);
        const idxRow = Math.floor(idx / 7);
        if (idx !== prev + 1 || idxRow !== prevRow) {
            flush(runStart, prev);
            runStart = idx;
        }
        prev = idx;
    }
    flush(runStart, prev);
    return segments;
}

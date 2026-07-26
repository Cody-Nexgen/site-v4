import { eachDayOfInterval, format, isAfter, isBefore, startOfDay } from 'date-fns';
import type { CalendarEvent } from './schedulingTypes';

export type RecurrenceEditTarget = 'occurrence' | 'series';

const DATE_KEY_FORMAT = 'yyyy-MM-dd';

export function calendarDateKey(value: Date | string): string {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = typeof value === 'string' ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? '' : format(date, DATE_KEY_FORMAT);
}

export function isRecurringEvent(event: CalendarEvent): boolean {
    return Boolean(event.repeat && event.repeat !== 'none');
}

export function isGeneratedOccurrence(event: CalendarEvent): boolean {
    return Boolean(event.recurrenceMasterId && event.occurrenceDate);
}

export function recurrenceOccurrenceId(masterId: string, date: Date | string): string {
    return `${masterId}::occurrence::${calendarDateKey(date)}`;
}

function normalizedWeekdays(event: CalendarEvent, anchor: Date): number[] {
    if (event.repeat === 'daily') return [0, 1, 2, 3, 4, 5, 6];
    const selected = event.recurrenceWeekdays
        ?.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return selected?.length ? [...new Set(selected)].sort() : [anchor.getDay()];
}

function occurrenceForDate(master: CalendarEvent, date: Date): CalendarEvent {
    const dateKey = calendarDateKey(date);
    return {
        ...master,
        id: recurrenceOccurrenceId(master.id, date),
        date: date.toDateString(),
        seriesId: master.seriesId ?? `series_${master.id}`,
        recurrenceMasterId: master.id,
        recurrenceMasterDate: master.date,
        occurrenceDate: dateKey,
    };
}

/** Expands only the requested visible range. Persisted recurring rows remain series masters. */
export function expandCalendarEventsInRange(
    events: CalendarEvent[],
    rangeStart: Date,
    rangeEnd: Date,
): CalendarEvent[] {
    const start = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    if (isAfter(start, end)) return [];

    const expanded: CalendarEvent[] = [];
    for (const event of events) {
        const anchor = startOfDay(new Date(event.date));
        if (Number.isNaN(anchor.getTime())) continue;

        if (!isRecurringEvent(event) || isGeneratedOccurrence(event)) {
            if (!isBefore(anchor, start) && !isAfter(anchor, end)) expanded.push(event);
            continue;
        }

        const firstVisible = isAfter(anchor, start) ? anchor : start;
        const weekdays = new Set(normalizedWeekdays(event, anchor));
        const exceptions = new Set(event.recurrenceExceptions ?? []);
        for (const day of eachDayOfInterval({ start: firstVisible, end })) {
            const key = calendarDateKey(day);
            if (weekdays.has(day.getDay()) && !exceptions.has(key)) {
                expanded.push(occurrenceForDate(event, day));
            }
        }
    }
    return expanded;
}

/**
 * Converts legacy finite, materialized series rows into one infinite series master.
 * One-off events and already-normalized masters pass through unchanged.
 */
export function migrateMaterializedCalendarSeries(events: CalendarEvent[]): {
    events: CalendarEvent[];
    migratedSeries: number;
} {
    const seriesRows = new Map<string, CalendarEvent[]>();
    const untouched: CalendarEvent[] = [];

    for (const event of events) {
        if (isRecurringEvent(event) && event.seriesId) {
            const rows = seriesRows.get(event.seriesId) ?? [];
            rows.push(event);
            seriesRows.set(event.seriesId, rows);
        } else {
            untouched.push(event);
        }
    }

    let migratedSeries = 0;
    for (const rows of seriesRows.values()) {
        if (rows.length === 1 && !isGeneratedOccurrence(rows[0])) {
            untouched.push(rows[0]);
            continue;
        }

        const sorted = [...rows].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        const seed = sorted[0];
        const recurrenceWeekdays =
            seed.repeat === 'weekly'
                ? [...new Set(sorted.map((row) => new Date(row.date).getDay()))].sort()
                : undefined;
        const recurrenceExceptions = [
            ...new Set(sorted.flatMap((row) => row.recurrenceExceptions ?? [])),
        ].sort();

        untouched.push({
            ...seed,
            id: seed.recurrenceMasterId ?? seed.id,
            date: seed.recurrenceMasterDate ?? seed.date,
            recurrenceWeekdays,
            recurrenceExceptions: recurrenceExceptions.length ? recurrenceExceptions : undefined,
            recurrenceMasterId: undefined,
            recurrenceMasterDate: undefined,
            occurrenceDate: undefined,
        });
        migratedSeries += 1;
    }

    return { events: untouched, migratedSeries };
}

export function withOccurrenceException(master: CalendarEvent, occurrence: CalendarEvent): CalendarEvent {
    const key = occurrence.occurrenceDate ?? calendarDateKey(occurrence.date);
    return {
        ...master,
        recurrenceExceptions: [...new Set([...(master.recurrenceExceptions ?? []), key])].sort(),
    };
}

export function recurrenceLabel(event: CalendarEvent): string | null {
    if (!isRecurringEvent(event)) return null;
    if (event.repeat === 'daily') return 'Every day';
    const anchor = new Date(event.date);
    if (Number.isNaN(anchor.getTime())) return 'Repeating';
    const weekdays = normalizedWeekdays(event, anchor);
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Repeating on ${weekdays.map((day) => labels[day]).join(', ')}`;
}

export function sameSeriesSlot(a: CalendarEvent, b: CalendarEvent): boolean {
    return Boolean(
        a.seriesId &&
            a.seriesId === b.seriesId &&
            a.startHour === b.startHour &&
            a.startMin === b.startMin &&
            a.durationMin === b.durationMin,
    );
}

/**
 * Compatibility shim for integrations that previously materialized 60 rows.
 * It now returns the persisted master only.
 */
export function expandRecurringEvent(event: CalendarEvent): CalendarEvent[] {
    if (!isRecurringEvent(event)) return [event];
    return [{
        ...event,
        seriesId: event.seriesId ?? `series_${event.id}`,
        recurrenceMasterId: undefined,
        recurrenceMasterDate: undefined,
        occurrenceDate: undefined,
    }];
}

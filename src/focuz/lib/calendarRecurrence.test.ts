import { deepEqual, equal, notEqual } from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEvent } from './schedulingTypes';
import {
    calendarDateKey,
    expandCalendarEventsInRange,
    migrateMaterializedCalendarSeries,
    recurrenceOccurrenceId,
    withOccurrenceException,
} from './calendarRecurrence';

function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
    return {
        id: 'event-1',
        title: 'Focus',
        date: new Date(2026, 6, 13).toDateString(),
        allDay: false,
        startHour: 9,
        startMin: 0,
        durationMin: 30,
        color: '#336699',
        ...patch,
    };
}

test('expands daily series only inside the visible range with stable IDs', () => {
    const master = event({ repeat: 'daily', seriesId: 'series-1' });
    const start = new Date(2026, 6, 20);
    const end = new Date(2026, 6, 22);
    const first = expandCalendarEventsInRange([master], start, end);
    const second = expandCalendarEventsInRange([master], start, end);

    equal(first.length, 3);
    deepEqual(first.map((item) => item.id), second.map((item) => item.id));
    equal(first[0].id, recurrenceOccurrenceId(master.id, start));
    equal(first[0].recurrenceMasterId, master.id);
});

test('supports arbitrary selected weekdays and occurrence exceptions', () => {
    const master = event({
        repeat: 'weekly',
        recurrenceWeekdays: [1, 3, 5],
        recurrenceExceptions: ['2026-07-15'],
    });
    const expanded = expandCalendarEventsInRange(
        [master],
        new Date(2026, 6, 13),
        new Date(2026, 6, 19),
    );

    deepEqual(expanded.map((item) => item.occurrenceDate), ['2026-07-13', '2026-07-17']);
});

test('deleting one occurrence records an exception without mutating the master ID', () => {
    const master = event({ repeat: 'daily' });
    const occurrence = expandCalendarEventsInRange(
        [master],
        new Date(2026, 6, 14),
        new Date(2026, 6, 14),
    )[0];
    const updated = withOccurrenceException(master, occurrence);

    equal(updated.id, master.id);
    deepEqual(updated.recurrenceExceptions, ['2026-07-14']);
    equal(
        expandCalendarEventsInRange([updated], new Date(2026, 6, 14), new Date(2026, 6, 14)).length,
        0,
    );
});

test('migrates materialized rows to one master while preserving one-off events', () => {
    const legacy = [0, 1, 2].map((offset) =>
        event({
            id: offset === 0 ? 'legacy' : `legacy_${offset}`,
            date: new Date(2026, 6, 13 + offset).toDateString(),
            repeat: 'daily',
            seriesId: 'legacy-series',
        }),
    );
    const booking = event({
        id: 'booking',
        date: new Date(2026, 6, 16).toDateString(),
        bookingLinkId: 'booking-link',
    });
    const migrated = migrateMaterializedCalendarSeries([...legacy, booking]);

    equal(migrated.migratedSeries, 1);
    equal(migrated.events.length, 2);
    equal(migrated.events.filter((item) => item.seriesId === 'legacy-series').length, 1);
    equal(migrated.events.find((item) => item.id === 'booking')?.bookingLinkId, 'booking-link');
    notEqual(calendarDateKey(migrated.events[0].date), '');
});

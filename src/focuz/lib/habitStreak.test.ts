import { equal } from 'node:assert/strict';
import test from 'node:test';
import { computeHabitStreak } from './habitStreak';

test('habit streak counts through today and ignores future check-ins', () => {
    const now = new Date(2026, 6, 14, 12);
    equal(
        computeHabitStreak(
            [
                new Date(2026, 6, 12).toISOString(),
                new Date(2026, 6, 13).toISOString(),
                new Date(2026, 6, 14).toISOString(),
                new Date(2026, 6, 15).toISOString(),
            ],
            now,
        ),
        3,
    );
});

test('habit streak may end yesterday without backfilling earlier gaps', () => {
    const now = new Date(2026, 6, 14, 12);
    equal(
        computeHabitStreak(
            [
                new Date(2026, 6, 10).toISOString(),
                new Date(2026, 6, 12).toISOString(),
                new Date(2026, 6, 13).toISOString(),
            ],
            now,
        ),
        2,
    );
});

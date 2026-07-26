const DAY_MS = 24 * 60 * 60 * 1000;

function localDayNumber(value: string | Date): number | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** Current streak, allowing yesterday as the latest check-in until today is checked. */
export function computeHabitStreak(checkins: string[], now = new Date()): number {
    const today = localDayNumber(now);
    if (today == null) return 0;

    const days = new Set(
        checkins
            .map(localDayNumber)
            .filter((day): day is number => day != null && day <= today),
    );
    let cursor = days.has(today) ? today : today - 1;
    let streak = 0;
    while (days.has(cursor)) {
        streak += 1;
        cursor -= 1;
    }
    return streak;
}

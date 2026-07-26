const STORAGE_KEY = 'dashboardOpenDates';

export function computeStreakFromDates(dates: string[]): { current: number; best: number } {
    if (dates.length === 0) return { current: 0, best: 0 };

    const unique = [...new Set(dates)];
    const sorted = unique
        .map((d) => new Date(d).setHours(0, 0, 0, 0))
        .sort((a, b) => a - b);

    let best = 0;
    let run = 0;
    let prev: number | null = null;
    const dayMs = 86400000;

    for (const t of sorted) {
        if (prev !== null && t - prev === dayMs) run += 1;
        else run = 1;
        best = Math.max(best, run);
        prev = t;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateSet = new Set(unique);

    if (!dateSet.has(today.toDateString()) && !dateSet.has(yesterday.toDateString())) {
        return { current: 0, best };
    }

    let cursor = dateSet.has(today.toDateString()) ? today : yesterday;
    let current = 0;
    while (dateSet.has(cursor.toDateString())) {
        current += 1;
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() - 1);
    }

    return { current, best: Math.max(best, current) };
}

export async function recordDashboardOpen(): Promise<{ current: number; best: number }> {
    const todayStr = new Date().toDateString();
    const result = await chrome.storage.local.get([STORAGE_KEY, 'dashboardBestStreak']);
    const dates: string[] = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];

    if (!dates.includes(todayStr)) {
        dates.push(todayStr);
        try {
            const { onDailyStreak } = await import('./progressionService');
            const { current } = computeStreakFromDates(dates);
            await onDailyStreak(current);
        } catch {
            /* progression optional */
        }
    }

    const { current, best } = computeStreakFromDates(dates);
    const prevBest = typeof result.dashboardBestStreak === 'number' ? result.dashboardBestStreak : 0;
    const dashboardBestStreak = Math.max(best, prevBest);

    await chrome.storage.local.set({
        [STORAGE_KEY]: dates,
        dashboardStreak: current,
        dashboardBestStreak,
    });

    return { current, best: dashboardBestStreak };
}

export async function loadDashboardStreak(): Promise<{ current: number; best: number }> {
    const result = await chrome.storage.local.get([STORAGE_KEY, 'dashboardStreak', 'dashboardBestStreak']);
    const dates: string[] = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    if (dates.length) {
        const computed = computeStreakFromDates(dates);
        return {
            current: computed.current,
            best: Math.max(computed.best, (result.dashboardBestStreak as number) || 0),
        };
    }
    return {
        current: (result.dashboardStreak as number) || 0,
        best: (result.dashboardBestStreak as number) || 0,
    };
}

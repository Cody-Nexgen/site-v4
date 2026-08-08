/** Absolute ceiling for any calendar day. */
export const MAX_DAY_SCREEN_MS = 24 * 60 * 60 * 1000;

function msSinceLocalMidnight(now: Date): number {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, now.getTime() - midnight);
}

function isSameLocalDay(dateStr: string | undefined, now: Date): boolean {
    if (!dateStr) return true;
    return dateStr === now.toDateString();
}

/**
 * Cap stored day totals for display.
 * For "today", also clamp to elapsed wall-clock since local midnight so a bad
 * flush can't show 24h at 4pm.
 */
export function capDayScreenMs(
    ms: number,
    opts?: { date?: string; now?: Date },
): number {
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    const now = opts?.now ?? new Date();
    const max = isSameLocalDay(opts?.date, now)
        ? Math.min(MAX_DAY_SCREEN_MS, msSinceLocalMidnight(now))
        : MAX_DAY_SCREEN_MS;
    return Math.min(ms, max);
}

export function normalizeScreenDomain(hostname: string): string {
    return hostname.replace(/^www\./i, '').toLowerCase();
}

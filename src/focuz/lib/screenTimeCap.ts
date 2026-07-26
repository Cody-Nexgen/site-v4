/** One calendar day cannot exceed 24h of tracked screen time. */
export const MAX_DAY_SCREEN_MS = 24 * 60 * 60 * 1000;

export function capDayScreenMs(ms: number): number {
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.min(ms, MAX_DAY_SCREEN_MS);
}

export function normalizeScreenDomain(hostname: string): string {
    return hostname.replace(/^www\./i, '').toLowerCase();
}

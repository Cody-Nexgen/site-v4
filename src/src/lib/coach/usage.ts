/**
 * Client-side FocuzAI usage meter, measured in model tokens. Each coach reply
 * records the tokens it used (exact counts from Gemini, reported by the
 * ai-coach-chat function) as a timestamped entry in localStorage, so the
 * settings popover can show daily/weekly usage as a percentage and the
 * composer can enforce soft fair-use limits — the limits are what keep the $8
 * Pro plan profitable. Think (Gemini Pro) replies also count toward their own
 * daily budget.
 */

/** Token totals for the current windows. */
export type CoachUsage = { today: number; week: number; thinkToday: number };

export type CoachTier = 'free' | 'pro';

/**
 * Token budgets. A typical coach reply is ~6–8k tokens (system prompt + live
 * context + history in, ~500 out), so Pro's day budget is ≈ 100 replies and
 * the week ≈ 400. Free is Pro-only today but keeps a budget for later.
 */
export const COACH_TOKEN_LIMITS: Record<CoachTier, { day: number; week: number; thinkDay: number }> = {
    free: { day: 60_000, week: 240_000, thinkDay: 0 },
    pro: { day: 750_000, week: 3_000_000, thinkDay: 150_000 },
};

/** Rough tokens-per-character for estimates when exact counts are unavailable. */
const CHARS_PER_TOKEN = 4;
/** System prompt + live context overhead added to estimated replies. */
const ESTIMATE_OVERHEAD = 3_000;

const KEY = 'focuznow-coach-usage-v2';
const KEEP_MS = 14 * 24 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

export type UsageEntry = { t: number; tokens: number; think?: boolean };

function read(now: number): UsageEntry[] {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as UsageEntry[];
        return Array.isArray(arr)
            ? arr.filter((e) => typeof e?.t === 'number' && typeof e.tokens === 'number' && now - e.t < KEEP_MS)
            : [];
    } catch {
        return [];
    }
}

function write(entries: UsageEntry[]) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(entries.slice(-5000)));
    } catch { /* ignore */ }
}

/** Estimate tokens for a turn from its text (demo mode / missing server counts). */
export function estimateTokens(...texts: string[]): number {
    const chars = texts.reduce((n, s) => n + (s?.length ?? 0), 0);
    return ESTIMATE_OVERHEAD + Math.ceil(chars / CHARS_PER_TOKEN);
}

export function recordCoachTokens(tokens: number, think: boolean, now = Date.now()) {
    if (!(tokens > 0)) return;
    const entries = read(now);
    entries.push({ t: now, tokens: Math.round(tokens), think });
    write(entries);
}

/** Sum entries into today (since local midnight), rolling 7 days, and Think today. */
export function tallyUsage(entries: UsageEntry[], now = new Date()): CoachUsage {
    const ts = now.getTime();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = ts - 7 * DAY_MS;
    let today = 0;
    let week = 0;
    let thinkToday = 0;
    for (const e of entries) {
        if (e.t >= dayStart) {
            today += e.tokens;
            if (e.think) thinkToday += e.tokens;
        }
        if (e.t >= weekStart) week += e.tokens;
    }
    return { today, week, thinkToday };
}

export function readCoachUsage(now = new Date()): CoachUsage {
    return tallyUsage(read(now.getTime()), now);
}

/** Usage as percentages of the tier's budgets (0–100, unrounded — format for display). */
export function usagePercent(u: CoachUsage, tier: CoachTier): { day: number; week: number; think: number } {
    const l = COACH_TOKEN_LIMITS[tier];
    const pct = (v: number, max: number) => (max > 0 ? Math.min(100, (v / max) * 100) : 0);
    return { day: pct(u.today, l.day), week: pct(u.week, l.week), think: pct(u.thinkToday, l.thinkDay) };
}

/** "0", "<1", or a whole number — a used-but-tiny share shouldn't read as 0%. */
export function formatPercent(pct: number): string {
    if (pct <= 0) return '0';
    if (pct < 1) return '<1';
    return String(Math.round(pct));
}

/** First budget the usage has used up, or null. `think` = sending with FocuzAI Think. */
export function limitHit(u: CoachUsage, tier: CoachTier, think = false): 'day' | 'week' | 'thinkDay' | null {
    const l = COACH_TOKEN_LIMITS[tier];
    if (u.today >= l.day) return 'day';
    if (u.week >= l.week) return 'week';
    if (think && u.thinkToday >= l.thinkDay) return 'thinkDay';
    return null;
}

export function usageLimitHit(tier: CoachTier, think = false, now = new Date()): 'day' | 'week' | 'thinkDay' | null {
    return limitHit(readCoachUsage(now), tier, think);
}

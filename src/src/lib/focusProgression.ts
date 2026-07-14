export const PROGRESSION_STORAGE_KEY = 'focusProgressionV1';

export const FOCUS_RANKS = [
    { level: 1, name: 'Beginner' },
    { level: 8, name: 'Disciplined' },
    { level: 22, name: 'Deep Worker' },
    { level: 41, name: 'Elite' },
    { level: 75, name: 'Master' },
    { level: 100, name: 'Legend' },
] as const;

export type ProgressionEvent =
    | 'pomodoro_complete'
    | 'block_resisted'
    | 'habit_checkin'
    | 'achievement_unlock'
    | 'challenge_complete'
    | 'daily_streak';

export type ProgressionStats = {
    totalPomodoros: number;
    totalBlocksResisted: number;
    totalHabitCheckins: number;
    focusMinutesTotal: number;
    noShortsStreakDays: number;
    noShortsLastDate: string;
    noTiktokStreakDays: number;
    noTiktokLastDate: string;
    weekPomodorosKey: string;
    weekPomodorosCount: number;
    todayPomodorosKey: string;
    todayPomodorosCount: number;
};

export type ActiveChallengeSnapshot = {
    id: string;
    startedAt: string;
    title: string;
    description: string;
    icon: string;
    metric: string;
    target: number;
    baseline: number;
    xpReward: number;
    coinReward: number;
};

export type FocusProgressionState = {
    version: 1;
    xp: number;
    coins: number;
    ownedCosmetics: string[];
    equippedCosmetics: { frame?: string; badge?: string; widget?: string };
    completedChallenges: string[];
    activeChallenges: ActiveChallengeSnapshot[];
    awardedKeys: string[];
    stats: ProgressionStats;
    publicProfileEnabled: boolean;
    lastSyncedAt?: string;
};

export type ProgressionAward = {
    xp: number;
    coins: number;
    leveledUp: boolean;
    newLevel?: number;
    newRank?: string;
};

export type LevelProgress = {
    level: number;
    rank: string;
    xp: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    progressPct: number;
    isMaxLevel: boolean;
};

const EVENT_REWARDS: Record<ProgressionEvent, { xp: number; coins: number }> = {
    pomodoro_complete: { xp: 25, coins: 5 },
    block_resisted: { xp: 5, coins: 1 },
    habit_checkin: { xp: 15, coins: 3 },
    achievement_unlock: { xp: 50, coins: 10 },
    challenge_complete: { xp: 0, coins: 0 },
    daily_streak: { xp: 10, coins: 2 },
};

const MAX_DAILY_BLOCK_AWARDS = 10;

export function defaultProgressionState(): FocusProgressionState {
    return {
        version: 1,
        xp: 0,
        coins: 0,
        ownedCosmetics: [],
        equippedCosmetics: {},
        completedChallenges: [],
        activeChallenges: [],
        awardedKeys: [],
        stats: {
            totalPomodoros: 0,
            totalBlocksResisted: 0,
            totalHabitCheckins: 0,
            focusMinutesTotal: 0,
            noShortsStreakDays: 0,
            noShortsLastDate: '',
            noTiktokStreakDays: 0,
            noTiktokLastDate: '',
            weekPomodorosKey: '',
            weekPomodorosCount: 0,
            todayPomodorosKey: '',
            todayPomodorosCount: 0,
        },
        publicProfileEnabled: false,
    };
}

/** Cumulative XP required to reach a given level (level 1 = 0). */
export function xpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.floor(25 * Math.pow(level - 1, 1.5));
}

export function levelFromXp(xp: number): number {
    let level = 1;
    while (level < 100 && xp >= xpRequiredForLevel(level + 1)) {
        level += 1;
    }
    return level;
}

export function rankForLevel(level: number): string {
    let rank: string = FOCUS_RANKS[0].name;
    for (const milestone of FOCUS_RANKS) {
        if (level >= milestone.level) rank = milestone.name;
    }
    return rank;
}

export function getLevelProgress(xp: number): LevelProgress {
    const level = levelFromXp(xp);
    const rank = rankForLevel(level);
    const currentThreshold = xpRequiredForLevel(level);
    const nextThreshold = level >= 100 ? currentThreshold : xpRequiredForLevel(level + 1);
    const xpIntoLevel = xp - currentThreshold;
    const xpForNextLevel = Math.max(1, nextThreshold - currentThreshold);
    const progressPct = level >= 100 ? 100 : Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100));

    return {
        level,
        rank,
        xp,
        xpIntoLevel,
        xpForNextLevel,
        progressPct,
        isMaxLevel: level >= 100,
    };
}

/** Estimate deep-work hours until next level from remaining XP (≈1 XP per focus minute). */
export function hoursUntilNextMilestone(xp: number): number | null {
    const progress = getLevelProgress(xp);
    if (progress.isMaxLevel) return null;
    const xpLeft = Math.max(0, progress.xpForNextLevel - progress.xpIntoLevel);
    return Math.max(0.5, Math.round((xpLeft / 60) * 10) / 10);
}

export function milestoneLabel(xp: number): string {
    const hours = hoursUntilNextMilestone(xp);
    if (hours == null) return 'Maximum level reached';
    if (hours < 1) return `${Math.round(hours * 60)} min of deep work until next level`;
    return `${hours} hour${hours === 1 ? '' : 's'} of deep work until next level`;
}

function todayKey(): string {
    return new Date().toDateString();
}

function isoWeekKey(d = new Date()): string {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${week}`;
}

function bumpPomodoroPeriodCounters(stats: ProgressionStats): void {
    const week = isoWeekKey();
    const today = todayKey();
    if (stats.weekPomodorosKey !== week) {
        stats.weekPomodorosKey = week;
        stats.weekPomodorosCount = 1;
    } else {
        stats.weekPomodorosCount += 1;
    }
    if (stats.todayPomodorosKey !== today) {
        stats.todayPomodorosKey = today;
        stats.todayPomodorosCount = 1;
    } else {
        stats.todayPomodorosCount += 1;
    }
}

function normalizeProgressionStats(stats: ProgressionStats): ProgressionStats {
    return {
        ...stats,
        weekPomodorosKey: stats.weekPomodorosKey ?? '',
        weekPomodorosCount: stats.weekPomodorosCount ?? 0,
        todayPomodorosKey: stats.todayPomodorosKey ?? '',
        todayPomodorosCount: stats.todayPomodorosCount ?? 0,
    };
}

function canAward(state: FocusProgressionState, dedupKey: string): boolean {
    return !state.awardedKeys.includes(dedupKey);
}

function markAwarded(state: FocusProgressionState, dedupKey: string): void {
    if (!state.awardedKeys.includes(dedupKey)) {
        state.awardedKeys.push(dedupKey);
    }
    if (state.awardedKeys.length > 500) {
        state.awardedKeys = state.awardedKeys.slice(-300);
    }
}

export function applyProgressionEvent(
    state: FocusProgressionState,
    event: ProgressionEvent,
    opts?: {
        dedupKey?: string;
        focusMinutes?: number;
        xpOverride?: number;
        coinsOverride?: number;
        streakDays?: number;
    },
): { state: FocusProgressionState; award: ProgressionAward | null } {
    const dedupKey = opts?.dedupKey ?? `${event}:${todayKey()}`;
    if (!canAward(state, dedupKey)) {
        return { state, award: null };
    }

    if (event === 'block_resisted') {
        const dayPrefix = `block_resisted:${todayKey()}:`;
        const dayCount = state.awardedKeys.filter((k) => k.startsWith(dayPrefix)).length;
        if (dayCount >= MAX_DAILY_BLOCK_AWARDS) {
            return { state, award: null };
        }
    }

    const base = EVENT_REWARDS[event];
    let xpGain = opts?.xpOverride ?? base.xp;
    let coinGain = opts?.coinsOverride ?? base.coins;

    if (event === 'daily_streak' && opts?.streakDays) {
        xpGain = Math.min(100, base.xp * opts.streakDays);
        coinGain = Math.min(20, base.coins * Math.ceil(opts.streakDays / 3));
    }

    if (event === 'pomodoro_complete') {
        state.stats.totalPomodoros += 1;
        state.stats.focusMinutesTotal += opts?.focusMinutes ?? 25;
        bumpPomodoroPeriodCounters(state.stats);
    } else if (event === 'block_resisted') {
        state.stats.totalBlocksResisted += 1;
    } else if (event === 'habit_checkin') {
        state.stats.totalHabitCheckins += 1;
    }

    const prevLevel = levelFromXp(state.xp);
    state.xp += xpGain;
    state.coins += coinGain;
    markAwarded(state, dedupKey);

    const newLevel = levelFromXp(state.xp);
    const leveledUp = newLevel > prevLevel;

    return {
        state,
        award: {
            xp: xpGain,
            coins: coinGain,
            leveledUp,
            newLevel: leveledUp ? newLevel : undefined,
            newRank: leveledUp ? rankForLevel(newLevel) : undefined,
        },
    };
}

export function purchaseCosmetic(
    state: FocusProgressionState,
    itemId: string,
    cost: number,
): { state: FocusProgressionState; ok: boolean; error?: string } {
    if (state.ownedCosmetics.includes(itemId)) {
        return { state, ok: false, error: 'Already owned' };
    }
    if (state.coins < cost) {
        return { state, ok: false, error: 'Not enough coins' };
    }
    return {
        state: {
            ...state,
            coins: state.coins - cost,
            ownedCosmetics: [...state.ownedCosmetics, itemId],
        },
        ok: true,
    };
}

export function equipCosmetic(
    state: FocusProgressionState,
    type: 'frame' | 'badge' | 'widget',
    itemId: string | null,
): FocusProgressionState {
    if (itemId && !state.ownedCosmetics.includes(itemId)) return state;
    return {
        ...state,
        equippedCosmetics: {
            ...state.equippedCosmetics,
            [type]: itemId ?? undefined,
        },
    };
}

export function normalizeProgressionState(raw: unknown): FocusProgressionState {
    const base = defaultProgressionState();
    if (!raw || typeof raw !== 'object') return base;
    const r = raw as Partial<FocusProgressionState>;
    return {
        ...base,
        ...r,
        version: 1,
        stats: normalizeProgressionStats({ ...base.stats, ...(r.stats ?? {}) }),
        ownedCosmetics: Array.isArray(r.ownedCosmetics) ? r.ownedCosmetics : [],
        equippedCosmetics: r.equippedCosmetics ?? {},
        completedChallenges: Array.isArray(r.completedChallenges) ? r.completedChallenges : [],
        activeChallenges: Array.isArray(r.activeChallenges) ? r.activeChallenges : [],
        awardedKeys: Array.isArray(r.awardedKeys) ? r.awardedKeys : [],
    };
}

export async function loadProgressionState(): Promise<FocusProgressionState> {
    const result = await chrome.storage.local.get(PROGRESSION_STORAGE_KEY);
    return normalizeProgressionState(result[PROGRESSION_STORAGE_KEY]);
}

export async function saveProgressionState(state: FocusProgressionState): Promise<void> {
    await chrome.storage.local.set({ [PROGRESSION_STORAGE_KEY]: state, xp: state.xp });
}

export async function awardProgressionEvent(
    event: ProgressionEvent,
    opts?: Parameters<typeof applyProgressionEvent>[2],
): Promise<{ state: FocusProgressionState; award: ProgressionAward | null }> {
    const current = await loadProgressionState();
    const result = applyProgressionEvent(current, event, opts);
    await saveProgressionState(result.state);
    try {
        chrome.runtime.sendMessage({ type: 'PROGRESSION_UPDATED', state: result.state, award: result.award }).catch(() => {});
    } catch {
        /* ignore */
    }
    return result;
}

/** Update platform-block streak counters (Shorts / TikTok challenges). */
export function tickPlatformStreak(
    state: FocusProgressionState,
    platform: 'shorts' | 'tiktok',
    blockedToday: boolean,
): FocusProgressionState {
    const today = todayKey();
    const stats = { ...state.stats };

    if (platform === 'shorts') {
        if (!blockedToday) {
            stats.noShortsStreakDays = 0;
            stats.noShortsLastDate = today;
            return { ...state, stats };
        }
        if (stats.noShortsLastDate === today) return state;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        stats.noShortsStreakDays =
            stats.noShortsLastDate === yesterday.toDateString()
                ? stats.noShortsStreakDays + 1
                : 1;
        stats.noShortsLastDate = today;
    } else {
        if (!blockedToday) {
            stats.noTiktokStreakDays = 0;
            stats.noTiktokLastDate = today;
            return { ...state, stats };
        }
        if (stats.noTiktokLastDate === today) return state;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        stats.noTiktokStreakDays =
            stats.noTiktokLastDate === yesterday.toDateString()
                ? stats.noTiktokStreakDays + 1
                : 1;
        stats.noTiktokLastDate = today;
    }

    return { ...state, stats };
}

export function buildPublicFocusStats(input: {
    progression: FocusProgressionState;
    focusScore: number;
    longestStreak: number;
    currentStreak?: number;
    hoursFocused: number;
    achievementsUnlocked: number;
    weeklyFocusMinutes?: number;
}): Record<string, unknown> {
    const progress = getLevelProgress(input.progression.xp);
    return {
        level: progress.level,
        rank: progress.rank,
        xp: input.progression.xp,
        focusScore: input.focusScore,
        currentStreak: input.currentStreak ?? input.longestStreak,
        longestStreak: input.longestStreak,
        weeklyFocusMinutes: input.weeklyFocusMinutes ?? 0,
        hoursFocused: Math.round(input.hoursFocused * 10) / 10,
        totalPomodoros: input.progression.stats.totalPomodoros,
        achievementsUnlocked: input.achievementsUnlocked,
        challengesCompleted: input.progression.completedChallenges.length,
        equippedFrame: input.progression.equippedCosmetics.frame ?? null,
        equippedBadge: input.progression.equippedCosmetics.badge ?? null,
        updatedAt: new Date().toISOString(),
    };
}

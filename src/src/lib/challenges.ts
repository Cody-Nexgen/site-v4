import type { ActiveChallengeSnapshot, FocusProgressionState } from './focusProgression';
import { applyProgressionEvent } from './focusProgression';
import {
    challengeDayKey,
    challengeWeekKey,
    getAllChallengeDefinitions,
    type DynamicChallengeInput,
} from './dynamicChallenges';

export type ChallengeMetric =
    | 'no_shorts_streak'
    | 'no_tiktok_streak'
    | 'focus_minutes'
    | 'total_pomodoros'
    | 'week_pomodoros'
    | 'today_pomodoros'
    | 'focus_score';

export type ChallengeDefinition = {
    id: string;
    title: string;
    description: string;
    icon: string;
    metric: ChallengeMetric;
    target: number;
    xpReward: number;
    coinReward: number;
    periodKind?: 'day' | 'week';
    periodKey?: string;
};

export type ChallengeStartResponse = {
    ok: boolean;
    active: boolean;
    persisted: boolean;
    started: boolean;
    reason?: string;
    error?: string;
    progression?: FocusProgressionState;
};

export function hasPersistedChallengeStart(
    response: Partial<ChallengeStartResponse>,
    challengeId: string,
): boolean {
    return response.progression?.activeChallenges?.some((challenge) => challenge.id === challengeId) === true;
}

export function hasCompletedChallenge(
    response: Partial<ChallengeStartResponse>,
    challengeId: string,
): boolean {
    return response.progression?.completedChallenges?.includes(challengeId) === true;
}

export function isChallengeStartResponseStaleOrPartial(
    response: Partial<ChallengeStartResponse>,
    challengeId: string,
): boolean {
    if (
        typeof response.ok !== 'boolean' ||
        typeof response.started !== 'boolean' ||
        typeof response.active !== 'boolean' ||
        typeof response.persisted !== 'boolean' ||
        !response.reason ||
        !Array.isArray(response.progression?.activeChallenges) ||
        !Array.isArray(response.progression?.completedChallenges)
    ) {
        return true;
    }
    const active = hasPersistedChallengeStart(response, challengeId);
    const completed = hasCompletedChallenge(response, challengeId);
    return response.active !== active ||
        response.persisted !== active ||
        (response.reason === 'completed' && !completed);
}

export const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
    {
        id: 'no_shorts_7',
        title: 'No Shorts for 7 Days',
        description: 'Keep YouTube Shorts blocked for 7 consecutive days',
        icon: '📵',
        metric: 'no_shorts_streak',
        target: 7,
        xpReward: 200,
        coinReward: 100,
    },
    {
        id: 'deep_work_30h',
        title: '30 Hours Deep Work',
        description: 'Log 30 hours of completed focus sessions',
        icon: '🧠',
        metric: 'focus_minutes',
        target: 30 * 60,
        xpReward: 500,
        coinReward: 250,
    },
    {
        id: 'pomodoro_100',
        title: '100 Pomodoros',
        description: 'Complete 100 focus sessions',
        icon: '🍅',
        metric: 'total_pomodoros',
        target: 100,
        xpReward: 400,
        coinReward: 200,
    },
    {
        id: 'no_tiktok_week',
        title: 'No TikTok Week',
        description: 'Keep TikTok blocked for 7 consecutive days',
        icon: '🚫',
        metric: 'no_tiktok_streak',
        target: 7,
        xpReward: 150,
        coinReward: 75,
    },
    {
        id: 'finals_sprint',
        title: 'Finish School Finals',
        description: 'Complete 20 focus sessions during exam season',
        icon: '🎓',
        metric: 'total_pomodoros',
        target: 20,
        xpReward: 300,
        coinReward: 150,
    },
];

export type ChallengeProgress = ChallengeDefinition & {
    active: boolean;
    startedAt?: string;
    current: number;
    completed: boolean;
    progressPct: number;
};

export type ChallengeRuntimeContext = {
    focusScore?: number;
    now?: Date;
};

function metricValue(
    state: FocusProgressionState,
    metric: ChallengeMetric,
    ctx?: ChallengeRuntimeContext,
): number {
    const s = state.stats;
    switch (metric) {
        case 'no_shorts_streak':
            return s.noShortsStreakDays;
        case 'no_tiktok_streak':
            return s.noTiktokStreakDays;
        case 'focus_minutes':
            return s.focusMinutesTotal;
        case 'total_pomodoros':
            return s.totalPomodoros;
        case 'week_pomodoros':
            return s.weekPomodorosKey === challengeWeekKey(ctx?.now)
                ? (s.weekPomodorosCount ?? 0)
                : 0;
        case 'today_pomodoros':
            return s.todayPomodorosKey === (ctx?.now ?? new Date()).toDateString()
                ? (s.todayPomodorosCount ?? 0)
                : 0;
        case 'focus_score':
            return ctx?.focusScore ?? 0;
        default:
            return 0;
    }
}

function usesBaseline(metric: ChallengeMetric): boolean {
    return metric === 'focus_minutes' || metric === 'total_pomodoros' || metric === 'week_pomodoros' || metric === 'today_pomodoros';
}

function isSnapshotInCurrentPeriod(
    snapshot: Pick<ActiveChallengeSnapshot, 'periodKind' | 'periodKey'>,
    now = new Date(),
): boolean {
    if (!snapshot.periodKind || !snapshot.periodKey) return true;
    return snapshot.periodKind === 'week'
        ? snapshot.periodKey === challengeWeekKey(now)
        : snapshot.periodKey === challengeDayKey(now);
}

function challengeProgressValue(
    state: FocusProgressionState,
    snapshot: Pick<ActiveChallengeSnapshot, 'metric' | 'baseline' | 'periodKind' | 'periodKey'>,
    ctx?: ChallengeRuntimeContext,
): number {
    if (!isSnapshotInCurrentPeriod(snapshot, ctx?.now)) return 0;
    const metric = snapshot.metric as ChallengeMetric;
    const raw = metricValue(state, metric, ctx);
    if (usesBaseline(metric)) {
        return Math.max(0, raw - snapshot.baseline);
    }
    return raw;
}

function definitionFromSnapshot(snapshot: ActiveChallengeSnapshot): ChallengeDefinition {
    return {
        id: snapshot.id,
        title: snapshot.title,
        description: snapshot.description,
        icon: snapshot.icon,
        metric: snapshot.metric as ChallengeMetric,
        target: snapshot.target,
        xpReward: snapshot.xpReward,
        coinReward: snapshot.coinReward,
        periodKind: snapshot.periodKind,
        periodKey: snapshot.periodKey,
    };
}

export function computeChallengeProgress(
    state: FocusProgressionState,
    dynamicInput?: Omit<DynamicChallengeInput, 'progression'>,
    ctx?: ChallengeRuntimeContext,
): ChallengeProgress[] {
    const runtimeContext = ctx ?? {
        focusScore: dynamicInput?.focusScore,
        now: dynamicInput?.now,
    };
    const defs = getAllChallengeDefinitions(
        dynamicInput ? { ...dynamicInput, progression: state } : undefined,
    );
    const activeSnapshots = state.activeChallenges.filter(
        (c): c is ActiveChallengeSnapshot =>
            typeof c.metric === 'string' &&
            typeof c.target === 'number' &&
            isSnapshotInCurrentPeriod(c, runtimeContext.now),
    );

    const merged = new Map<string, ChallengeDefinition>();
    for (const def of defs) merged.set(def.id, def);
    for (const snap of activeSnapshots) merged.set(snap.id, definitionFromSnapshot(snap));

    return Array.from(merged.values()).map((def) => {
        const activeEntry = activeSnapshots.find((c) => c.id === def.id);
        const completed = state.completedChallenges.includes(def.id);
        const effectiveDef = activeEntry ? definitionFromSnapshot(activeEntry) : def;
        const currentRaw = activeEntry
            ? challengeProgressValue(state, activeEntry, runtimeContext)
            : metricValue(state, effectiveDef.metric, runtimeContext);
        const current = Math.min(currentRaw, effectiveDef.target);
        const progressPct = effectiveDef.target > 0
            ? Math.min(100, Math.round((current / effectiveDef.target) * 100))
            : 0;

        return {
            ...effectiveDef,
            active: !!activeEntry,
            startedAt: activeEntry?.startedAt,
            current,
            completed,
            progressPct,
        };
    });
}

export function startChallenge(
    state: FocusProgressionState,
    def: ChallengeDefinition,
): FocusProgressionState {
    if (state.completedChallenges.includes(def.id)) return state;
    if (state.activeChallenges.some((c) => c.id === def.id)) return state;

    const baseline = usesBaseline(def.metric) ? metricValue(state, def.metric) : 0;
    const snapshot: ActiveChallengeSnapshot = {
        id: def.id,
        startedAt: new Date().toISOString(),
        title: def.title,
        description: def.description,
        icon: def.icon,
        metric: def.metric,
        target: def.target,
        baseline,
        xpReward: def.xpReward,
        coinReward: def.coinReward,
        periodKind: def.periodKind,
        periodKey: def.periodKey,
    };

    return {
        ...state,
        activeChallenges: [...state.activeChallenges.filter((c) => c.id !== def.id), snapshot],
    };
}

export function checkChallengeCompletions(
    state: FocusProgressionState,
    ctx?: ChallengeRuntimeContext,
): { state: FocusProgressionState; completed: ChallengeDefinition[] } {
    const completed: ChallengeDefinition[] = [];
    let next = state;

    const activeSnapshots = next.activeChallenges.filter(
        (c): c is ActiveChallengeSnapshot =>
            typeof c.metric === 'string' &&
            typeof c.target === 'number' &&
            isSnapshotInCurrentPeriod(c, ctx?.now),
    );

    for (const snap of activeSnapshots) {
        if (next.completedChallenges.includes(snap.id)) continue;
        const current = challengeProgressValue(next, snap, ctx);
        if (current < snap.target) continue;

        const def = definitionFromSnapshot(snap);
        next = {
            ...next,
            completedChallenges: [...next.completedChallenges, snap.id],
            activeChallenges: next.activeChallenges.filter((c) => c.id !== snap.id),
        };
        const result = applyProgressionEvent(next, 'challenge_complete', {
            dedupKey: `challenge:${snap.id}`,
            xpOverride: snap.xpReward,
            coinsOverride: snap.coinReward,
        });
        next = result.state;
        completed.push(def);
    }

    return { state: next, completed };
}

export function pruneStaleActiveChallenges(state: FocusProgressionState): FocusProgressionState {
    const validIds = new Set(getAllChallengeDefinitions().map((d) => d.id));
    const active = state.activeChallenges.filter((c) => {
        if (state.completedChallenges.includes(c.id)) return false;
        if (!isSnapshotInCurrentPeriod(c)) return false;
        if (typeof c.metric === 'string') return true;
        return validIds.has(c.id);
    });
    if (active.length === state.activeChallenges.length) return state;
    return { ...state, activeChallenges: active };
}

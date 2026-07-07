import type { FocusProgressionState } from './focusProgression';
import { applyProgressionEvent } from './focusProgression';
import { getAllChallengeDefinitions, type DynamicChallengeInput } from './dynamicChallenges';

export type ChallengeMetric =
    | 'no_shorts_streak'
    | 'no_tiktok_streak'
    | 'focus_minutes'
    | 'total_pomodoros';

export type ChallengeDefinition = {
    id: string;
    title: string;
    description: string;
    icon: string;
    metric: ChallengeMetric;
    target: number;
    xpReward: number;
    coinReward: number;
};

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

function metricValue(state: FocusProgressionState, metric: ChallengeMetric): number {
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
        default:
            return 0;
    }
}

export function computeChallengeProgress(
    state: FocusProgressionState,
    dynamicInput?: Omit<DynamicChallengeInput, 'progression'>,
): ChallengeProgress[] {
    const defs = getAllChallengeDefinitions(
        dynamicInput ? { ...dynamicInput, progression: state } : undefined,
    );
    return defs.map((def) => {
        const activeEntry = state.activeChallenges.find((c) => c.id === def.id);
        const completed = state.completedChallenges.includes(def.id);
        const current = metricValue(state, def.metric);
        const progressPct = Math.min(100, Math.round((current / def.target) * 100));

        return {
            ...def,
            active: !!activeEntry,
            startedAt: activeEntry?.startedAt,
            current: Math.min(current, def.target),
            completed,
            progressPct,
        };
    });
}

export function startChallenge(state: FocusProgressionState, challengeId: string): FocusProgressionState {
    if (state.completedChallenges.includes(challengeId)) return state;
    if (state.activeChallenges.some((c) => c.id === challengeId)) return state;
    return {
        ...state,
        activeChallenges: [
            ...state.activeChallenges,
            { id: challengeId, startedAt: new Date().toISOString() },
        ],
    };
}

export function checkChallengeCompletions(
    state: FocusProgressionState,
): { state: FocusProgressionState; completed: ChallengeDefinition[] } {
    const completed: ChallengeDefinition[] = [];
    let next = state;

    for (const def of getAllChallengeDefinitions()) {
        if (next.completedChallenges.includes(def.id)) continue;
        const isActive = next.activeChallenges.some((c) => c.id === def.id);
        if (!isActive) continue;

        if (metricValue(next, def.metric) >= def.target) {
            next = {
                ...next,
                completedChallenges: [...next.completedChallenges, def.id],
                activeChallenges: next.activeChallenges.filter((c) => c.id !== def.id),
            };
            const result = applyProgressionEvent(next, 'challenge_complete', {
                dedupKey: `challenge:${def.id}`,
                xpOverride: def.xpReward,
                coinsOverride: def.coinReward,
            });
            next = result.state;
            completed.push(def);
        }
    }

    return { state: next, completed };
}

import type { FocusProgressionState } from './focusProgression';
import type { ChallengeDefinition, ChallengeMetric } from './challenges';
import { CHALLENGE_DEFINITIONS } from './challenges';

export function challengeWeekKey(d = new Date()): string {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${week}`;
}

export function challengeDayKey(d = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export type DynamicChallengeInput = {
    progression: FocusProgressionState;
    dashboardStreak: number;
    focusScore: number;
    habitsCount: number;
    now?: Date;
};

function dyn(
    partial: Omit<ChallengeDefinition, 'metric' | 'target'> & {
        metric: ChallengeMetric;
        target: number;
    },
): ChallengeDefinition {
    return partial;
}

/** Weekly + daily challenges generated from live stats. */
export function generateDynamicChallenges(input: DynamicChallengeInput): ChallengeDefinition[] {
    const now = input.now ?? new Date();
    const week = challengeWeekKey(now);
    const today = challengeDayKey(now);
    const s = input.progression.stats;
    const out: ChallengeDefinition[] = [];

    const weeklyTarget = 5;
    out.push(
        dyn({
            id: `dyn_week_pomo_${week}`,
            title: 'Weekly Focus Sprint',
            description: `Complete ${weeklyTarget} pomodoros this week`,
            icon: '⚡',
            metric: 'week_pomodoros',
            target: weeklyTarget,
            periodKind: 'week',
            periodKey: week,
            xpReward: 120,
            coinReward: 60,
        }),
    );

    if (input.dashboardStreak >= 2) {
        out.push(
            dyn({
                id: `dyn_streak_hold_${today}`,
                title: 'Protect Your Streak',
                description: 'Complete 1 focus session today',
                icon: '🔥',
                metric: 'today_pomodoros',
                target: 1,
                periodKind: 'day',
                periodKey: today,
                xpReward: 80,
                coinReward: 40,
            }),
        );
    }

    const focusHours = Math.floor(s.focusMinutesTotal / 60);
    if (focusHours < 5) {
        out.push(
            dyn({
                id: `dyn_deep_5h_${week}`,
                title: 'First 5 Hours',
                description: 'Log 5 hours of total deep work',
                icon: '🌊',
                metric: 'focus_minutes',
                target: 300,
                periodKind: 'week',
                periodKey: week,
                xpReward: 200,
                coinReward: 100,
            }),
        );
    } else {
        out.push(
            dyn({
                id: `dyn_deep_next_${week}`,
                title: 'Deep Work Climb',
                description: 'Log 1 more hour of deep work',
                icon: '🏔️',
                metric: 'focus_minutes',
                target: 60,
                periodKind: 'week',
                periodKey: week,
                xpReward: 250,
                coinReward: 125,
            }),
        );
    }

    if (input.focusScore < 70) {
        out.push(
            dyn({
                id: `dyn_score_70_${today}`,
                title: 'Focuz Score Boost',
                description: 'Get your focus score above 70 today',
                icon: '📈',
                metric: 'focus_score',
                target: 70,
                periodKind: 'day',
                periodKey: today,
                xpReward: 100,
                coinReward: 50,
            }),
        );
    }

    if (input.habitsCount > 0 && s.noShortsStreakDays < 3) {
        out.push(
            dyn({
                id: `dyn_no_shorts_3_${week}`,
                title: 'Shorts Detox',
                description: 'Avoid YouTube Shorts for 3 days',
                icon: '📵',
                metric: 'no_shorts_streak',
                target: 3,
                periodKind: 'week',
                periodKey: week,
                xpReward: 150,
                coinReward: 75,
            }),
        );
    }

    return out;
}

export function getAllChallengeDefinitions(input?: DynamicChallengeInput): ChallengeDefinition[] {
    const dynamic = input ? generateDynamicChallenges(input) : [];
    const seen = new Set<string>();
    const merged: ChallengeDefinition[] = [];

    for (const def of [...CHALLENGE_DEFINITIONS, ...dynamic]) {
        if (seen.has(def.id)) continue;
        seen.add(def.id);
        merged.push(def);
    }
    return merged;
}

import type { FocusProgressionState } from './focusProgression';
import type { ChallengeDefinition, ChallengeMetric } from './challenges';
import { CHALLENGE_DEFINITIONS } from './challenges';

function isoWeekKey(d = new Date()): string {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${week}`;
}

function dayKey(d = new Date()): string {
    return d.toISOString().slice(0, 10);
}

export type DynamicChallengeInput = {
    progression: FocusProgressionState;
    dashboardStreak: number;
    focusScore: number;
    habitsCount: number;
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
    const week = isoWeekKey();
    const today = dayKey();
    const s = input.progression.stats;
    const out: ChallengeDefinition[] = [];

    const weeklyPomos = Math.min(s.totalPomodoros, 15);
    out.push(
        dyn({
            id: `dyn_week_pomo_${week}`,
            title: 'Weekly Focus Sprint',
            description: `Complete ${Math.max(5, weeklyPomos)} pomodoros this week`,
            icon: '⚡',
            metric: 'total_pomodoros',
            target: Math.max(5, weeklyPomos),
            xpReward: 120,
            coinReward: 60,
        }),
    );

    if (input.dashboardStreak >= 2) {
        out.push(
            dyn({
                id: `dyn_streak_hold_${today}`,
                title: 'Protect Your Streak',
                description: 'Open FocuzNow and complete 1 focus session today',
                icon: '🔥',
                metric: 'total_pomodoros',
                target: s.totalPomodoros + 1,
                xpReward: 80,
                coinReward: 40,
            }),
        );
    }

    if (s.focusMinutesTotal < 600) {
        out.push(
            dyn({
                id: `dyn_deep_5h_${week}`,
                title: 'First 5 Hours',
                description: 'Log 5 hours of total deep work',
                icon: '🌊',
                metric: 'focus_minutes',
                target: 300,
                xpReward: 200,
                coinReward: 100,
            }),
        );
    } else {
        const nextMilestone = Math.ceil((s.focusMinutesTotal + 60) / 60) * 60;
        out.push(
            dyn({
                id: `dyn_deep_next_${week}`,
                title: 'Deep Work Climb',
                description: `Reach ${Math.round(nextMilestone / 60)} hours of focus time`,
                icon: '🏔️',
                metric: 'focus_minutes',
                target: nextMilestone,
                xpReward: 250,
                coinReward: 125,
            }),
        );
    }

    if (input.focusScore < 70) {
        out.push(
            dyn({
                id: `dyn_score_70_${today}`,
                title: 'Focus Score Boost',
                description: 'Get your focus score above 70 today',
                icon: '📈',
                metric: 'total_pomodoros',
                target: s.totalPomodoros + 2,
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

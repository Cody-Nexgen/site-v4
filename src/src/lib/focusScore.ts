import { capDayScreenMs } from './screenTimeCap';

/** Domains commonly associated with distraction — lowers focus quality score. */
const DISTRACTION_HINTS = [
    'youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
    'reddit.com', 'facebook.com', 'netflix.com', 'twitch.tv', 'discord.com',
    'snapchat.com', 'pinterest.com', 'threads.net', 'linkedin.com/feed',
];

function isDistractionDomain(domain: string): boolean {
    const d = domain.toLowerCase();
    return DISTRACTION_HINTS.some((hint) => d.includes(hint.replace(/^www\./, '')));
}

export type FocusScoreInput = {
    todaySites?: Record<string, number>;
    todayTotalMs?: number;
    blockedToday?: number;
    dailyPlanner?: { done?: boolean }[];
    habits?: { checkins?: string[] }[];
    pomodoroSessionsToday?: number;
    streak?: number;
};

export type FocusScoreResult = {
    score: number;
    label: string;
    breakdown: { factor: string; points: number; max: number }[];
};

/** 0–100 focus quality score — rewards productive usage, not raw screen time. */
export function computeFocusScore(input: FocusScoreInput): FocusScoreResult {
    const todayStr = new Date().toDateString();
    const sites = input.todaySites ?? {};
    const totalMs = capDayScreenMs(input.todayTotalMs ?? Object.values(sites).reduce((a, b) => a + b, 0));

    let distractionMs = 0;
    for (const [domain, ms] of Object.entries(sites)) {
        if (isDistractionDomain(domain)) distractionMs += ms;
    }
    distractionMs = capDayScreenMs(distractionMs);

    const distractionRatio = totalMs > 0 ? distractionMs / totalMs : 0;
    const qualityPoints = Math.round(Math.max(0, 35 - distractionRatio * 35));

    const planner = input.dailyPlanner ?? [];
    const doneCount = planner.filter((p) => p.done).length;
    const taskPoints = planner.length === 0
        ? 15
        : Math.round((doneCount / planner.length) * 25);

    const habitsChecked = (input.habits ?? []).filter((h) => h.checkins?.includes(todayStr)).length;
    const habitPoints = Math.min(15, habitsChecked * 5);

    const blockPoints = Math.min(10, (input.blockedToday ?? 0) * 2);
    const pomodoroPoints = Math.min(10, (input.pomodoroSessionsToday ?? 0) * 5);
    const streakPoints = Math.min(5, Math.floor((input.streak ?? 0) / 3));

    const raw = qualityPoints + taskPoints + habitPoints + blockPoints + pomodoroPoints + streakPoints;
    const score = Math.min(100, Math.max(0, raw));

    const label =
        score >= 85 ? 'Excellent' :
        score >= 70 ? 'Strong' :
        score >= 50 ? 'Moderate' :
        score >= 30 ? 'Needs focus' : 'Getting started';

    return {
        score,
        label,
        breakdown: [
            { factor: 'Focus quality', points: qualityPoints, max: 35 },
            { factor: 'Tasks completed', points: taskPoints, max: 25 },
            { factor: 'Habits', points: habitPoints, max: 15 },
            { factor: 'Blocks resisted', points: blockPoints, max: 10 },
            { factor: 'Deep work sessions', points: pomodoroPoints, max: 10 },
            { factor: 'Streak bonus', points: streakPoints, max: 5 },
        ],
    };
}

export function focusScoreColor(score: number): string {
    if (score >= 85) return '#22c55e';
    if (score >= 70) return '#a855f7';
    if (score >= 50) return '#eab308';
    return '#ef4444';
}

type DayStat = { date: string; total: number; sites?: Record<string, number> };

/** Average focus score across all days with browsing data. */
export function computeAllTimeFocusScore(days: DayStat[]): { score: number; daysCounted: number } {
    const withData = days.filter((d) => capDayScreenMs(d.total ?? 0) > 0);
    if (withData.length === 0) return { score: 0, daysCounted: 0 };

    const total = withData.reduce(
        (sum, d) =>
            sum +
            computeFocusScore({
                todaySites: d.sites,
                todayTotalMs: d.total,
            }).score,
        0,
    );

    return {
        score: Math.round(total / withData.length),
        daysCounted: withData.length,
    };
}

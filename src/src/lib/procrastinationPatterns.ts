import { capDayScreenMs } from './screenTimeCap';

export type ProcrastinationPattern = {
    id: string;
    severity: 'low' | 'medium' | 'high';
    title: string;
    detail: string;
    suggestion: string;
};

const DISTRACTION_DOMAINS = [
    'youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
    'reddit.com', 'facebook.com', 'netflix.com', 'twitch.tv',
];

type DayStat = { date: string; total: number; sites?: Record<string, number> };

function distractionMs(sites: Record<string, number> = {}): number {
    let ms = 0;
    for (const [domain, time] of Object.entries(sites)) {
        if (DISTRACTION_DOMAINS.some((d) => domain.includes(d))) ms += time;
    }
    return capDayScreenMs(ms);
}

/** Detect procrastination patterns from local browsing analytics. */
export function detectProcrastinationPatterns(
    last7Days: DayStat[],
    dailyPlanner: { done?: boolean }[] = [],
): ProcrastinationPattern[] {
    const patterns: ProcrastinationPattern[] = [];
    if (!last7Days.length) return patterns;

    const recent = last7Days.slice(-7);
    const today = recent[recent.length - 1];
    const todayDistraction = distractionMs(today?.sites);
    const todayTotal = capDayScreenMs(today?.total ?? 0);

    if (todayTotal > 0 && todayDistraction / todayTotal > 0.45) {
        patterns.push({
            id: 'distraction_spike',
            severity: todayDistraction / todayTotal > 0.65 ? 'high' : 'medium',
            title: 'High distraction ratio today',
            detail: `${Math.round((todayDistraction / todayTotal) * 100)}% of your browsing was on distracting sites.`,
            suggestion: 'Try a 25-minute focus block or enable Nuclear Lockdown for your worst offenders.',
        });
    }

    const afternoonMs: number[] = [];
    for (const day of recent) {
        const sites = day.sites ?? {};
        let afternoon = 0;
        for (const [domain, ms] of Object.entries(sites)) {
            if (DISTRACTION_DOMAINS.some((d) => domain.includes(d))) afternoon += ms * 0.6;
        }
        afternoonMs.push(afternoon);
    }
    const avgAfternoon = afternoonMs.reduce((a, b) => a + b, 0) / afternoonMs.length;
    if (avgAfternoon > 45 * 60 * 1000) {
        patterns.push({
            id: 'afternoon_slump',
            severity: 'medium',
            title: 'Afternoon procrastination pattern',
            detail: 'Your distraction time tends to spike in the second half of the day.',
            suggestion: 'Schedule your hardest task before noon and block social media after 2 PM.',
        });
    }

    const incomplete = dailyPlanner.filter((p) => !p.done).length;
    const complete = dailyPlanner.filter((p) => p.done).length;
    if (incomplete >= 3 && complete === 0 && todayDistraction > 20 * 60 * 1000) {
        patterns.push({
            id: 'avoidance',
            severity: 'high',
            title: 'Task avoidance detected',
            detail: `${incomplete} tasks pending with significant distraction time and nothing completed.`,
            suggestion: 'Pick one small task and finish it in the next 10 minutes — momentum beats perfection.',
        });
    }

    const totals = recent.map((d) => capDayScreenMs(d.total ?? 0));
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const todayVsAvg = todayTotal - avg;
    if (todayVsAvg > avg * 0.5 && todayDistraction > 30 * 60 * 1000) {
        patterns.push({
            id: 'usage_spike',
            severity: 'low',
            title: 'Above-average browsing today',
            detail: 'You\'re spending more time online than your weekly average.',
            suggestion: 'Check your focus score and trim time on your top 3 sites.',
        });
    }

    const weekendDays = recent.filter((d) => {
        const day = new Date(d.date).getDay();
        return day === 0 || day === 6;
    });
    const weekdayDays = recent.filter((d) => {
        const day = new Date(d.date).getDay();
        return day >= 1 && day <= 5;
    });
    if (weekendDays.length && weekdayDays.length) {
        const weekendAvg = weekendDays.reduce((a, d) => a + distractionMs(d.sites), 0) / weekendDays.length;
        const weekdayAvg = weekdayDays.reduce((a, d) => a + distractionMs(d.sites), 0) / weekdayDays.length;
        if (weekendAvg > weekdayAvg * 1.8) {
            patterns.push({
                id: 'weekend_drift',
                severity: 'low',
                title: 'Weekend drift',
                detail: 'Weekends show significantly more distraction browsing than weekdays.',
                suggestion: 'Set lighter weekend focus targets or schedule one deep-work block Saturday morning.',
            });
        }
    }

    return patterns.sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.severity] - rank[b.severity];
    });
}

// LEGACY: pre-revamp version kept so it can be picked per page in Settings → Page versions.
// Copied from options/AchievementsTab.tsx; imports rewritten. Keep behavior changes out of this file.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Target, Flame, Zap, Crown, ShieldCheck, Sparkles, Gem, TrendingUp, Timer, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { computeAchievements, unlockedCount, type Achievement } from '../../lib/achievements';
import { computeFocusScore } from '../../lib/focusScore';
import { pluralize } from '../../lib/utils';
import { useFocusProgression, sendProgressionMessage } from '../../hooks/useFocusProgression';
import { FocusLevelCard } from '../../components/FocusLevelCard';
import { FOCUS_RANKS, levelFromXp } from '../../lib/focusProgression';
import { Popover } from '../../components/fz/Popover';

const AWARDED_ACHIEVEMENTS_KEY = 'focuznow_awarded_achievements';

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
    first_focus: Target,
    streak_3: Flame,
    streak_7: Zap,
    streak_30: Crown,
    blocker_10: ShieldCheck,
    focus_80: Sparkles,
    focus_95: Gem,
    habits_3: TrendingUp,
    pomodoro_5: Timer,
};

function AchievementTile({ a, shimmer }: { a: Achievement; shimmer: boolean }) {
    const Icon = ACHIEVEMENT_ICONS[a.id] ?? Sparkles;
    const anchor = useRef<HTMLDivElement>(null);
    const [hovered, setHovered] = useState(false);
    return (
        <>
            <div
                ref={anchor}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={`relative flex h-24 w-24 cursor-default flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border text-center transition-colors duration-150 ${
                    a.unlocked
                        ? 'border-[var(--fz-accent)]/45 bg-[var(--fz-bg-raised)]'
                        : 'border-[var(--fz-border)] bg-[var(--fz-bg-raised)] opacity-70'
                }`}
            >
                {shimmer && a.unlocked && <span className="fz-achievement-shimmer" aria-hidden />}
                <Icon size={22} strokeWidth={1.75} className={a.unlocked ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-4)]'} />
                <span className={`px-1.5 text-[11px] font-medium leading-tight ${a.unlocked ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-4)]'}`}>
                    {a.title}
                </span>
            </div>
            <Popover open={hovered} onClose={() => setHovered(false)} anchor={anchor}>
                <div className="max-w-52 space-y-1 p-1">
                    <p className="text-[13px] font-medium text-[var(--fz-text-1)]">{a.title}</p>
                    <p className="text-[12px] text-[var(--fz-text-3)]">{a.description}</p>
                    {!a.unlocked && <p className="text-[11px] text-[var(--fz-text-4)]">Locked</p>}
                </div>
            </Popover>
        </>
    );
}

export default function AchievementsTab() {
    const { engineState, last7DaysStats, streak, dashboardStreak, bestStreak } = useAuthStore();
    const { progression, refresh } = useFocusProgression();
    const awardedRef = useRef<Set<string>>(new Set());
    const [seenIds, setSeenIds] = useState<Set<string> | null>(null);

    useEffect(() => {
        chrome.storage.local.get(AWARDED_ACHIEVEMENTS_KEY).then((r) => {
            const list = (r[AWARDED_ACHIEVEMENTS_KEY] as string[]) || [];
            awardedRef.current = new Set(list);
            setSeenIds(new Set(list));
        });
    }, []);

    const todayIdx = (last7DaysStats?.length ?? 1) - 1;
    const todayData = todayIdx >= 0 ? last7DaysStats?.[todayIdx] : undefined;
    const planner = engineState.dailyPlanner ?? [];
    const habits = engineState.habits ?? [];

    const focusScore = useMemo(() => {
        return computeFocusScore({
            todaySites: todayData?.sites,
            todayTotalMs: todayData?.total,
            blockedToday: engineState.blockedToday,
            dailyPlanner: planner,
            habits,
            streak: dashboardStreak,
        }).score;
    }, [todayData, engineState.blockedToday, planner, habits, dashboardStreak]);

    const achievements = useMemo(
        () =>
            computeAchievements({
                streak: dashboardStreak,
                bestStreak: bestStreak || dashboardStreak,
                blockedToday: engineState.blockedToday ?? 0,
                focusScore,
                habitsCount: habits.length,
                pomodoroTotal: engineState.pomodoroSettings?.sessionsCompleted ?? 0,
                tasksCompletedToday: planner.filter((p: { done?: boolean }) => p.done).length,
            }),
        [dashboardStreak, bestStreak, engineState, focusScore, habits.length, planner],
    );

    useEffect(() => {
        const newlyUnlocked = achievements.filter(
            (a) => a.unlocked && !awardedRef.current.has(a.id),
        );
        if (newlyUnlocked.length === 0) return;

        void (async () => {
            for (const a of newlyUnlocked) {
                awardedRef.current.add(a.id);
                await sendProgressionMessage({
                    type: 'PROGRESSION_ACHIEVEMENT',
                    achievementId: a.id,
                });
            }
            await chrome.storage.local.set({
                [AWARDED_ACHIEVEMENTS_KEY]: Array.from(awardedRef.current),
            });
            await refresh();
        })();
    }, [achievements, refresh]);

    const unlocked = achievements.filter((a) => a.unlocked);
    const locked = achievements.filter((a) => !a.unlocked);

    const hoursFocused = progression
        ? Math.round((progression.stats.focusMinutesTotal / 60) * 10) / 10
        : 0;

    const currentLevel = progression ? levelFromXp(progression.xp) : 1;

    return (
        <div className="space-y-6 animate-fade-in-up">

            {progression && <FocusLevelCard progression={progression} />}

            <div className="rounded-lg border border-white/8 bg-surface p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Rank milestones</h2>
                <div className="flex flex-wrap gap-2">
                    {FOCUS_RANKS.map((rank) => (
                        <span
                            key={rank.level}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150 ${
                                rank.level <= currentLevel
                                    ? 'border-[var(--fz-accent)]/40 bg-[var(--fz-accent-soft)] text-[var(--fz-accent)]'
                                    : 'border-white/8 bg-white/4 text-neutral-600'
                            }`}
                        >
                            Lv {rank.level} · {rank.name}
                        </span>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-white/8 bg-surface p-5">
                <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-sm font-semibold text-white">Achievements</h2>
                    <span className="text-xs text-neutral-500 tabular-nums">
                        <span className="text-neutral-300 font-medium">{unlockedCount(achievements)}</span>
                        {' '}/ {achievements.length} unlocked
                    </span>
                </div>
                <div className="h-1.5 bg-white/6 rounded-full overflow-hidden mb-5">
                    <div
                        className="h-full bg-[var(--fz-accent)] rounded-full transition-all"
                        style={{ width: `${(unlockedCount(achievements) / achievements.length) * 100}%` }}
                    />
                </div>

                <div className="flex flex-wrap gap-3">
                    {[...unlocked, ...locked].map((a) => (
                        <AchievementTile
                            key={a.id}
                            a={a}
                            shimmer={seenIds !== null && a.unlocked && !seenIds.has(a.id)}
                        />
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-white/8 bg-surface p-5">
                <p className="text-xs text-neutral-500 leading-relaxed tabular-nums">
                    Focuz score:{' '}
                    <span className="font-semibold text-[var(--fz-text-1)]">
                        {focusScore}/100
                    </span>
                    {' '}· Streak: {pluralize(streak, 'day')} · Dashboard: {pluralize(dashboardStreak, 'day')} · Deep work: {hoursFocused}h
                </p>
            </div>
        </div>
    );
}

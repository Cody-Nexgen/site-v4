import { useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '../lib/store';
import { computeAchievements, unlockedCount } from '../lib/achievements';
import { computeFocusScore, focusScoreColor } from '../lib/focusScore';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { FocusLevelCard } from '../components/FocusLevelCard';
import { FOCUS_RANKS, levelFromXp } from '../lib/focusProgression';

const AWARDED_ACHIEVEMENTS_KEY = 'focuznow_awarded_achievements';

export default function AchievementsTab() {
    const { engineState, last7DaysStats, streak, dashboardStreak, bestStreak } = useAuthStore();
    const { progression, refresh } = useFocusProgression();
    const awardedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        chrome.storage.local.get(AWARDED_ACHIEVEMENTS_KEY).then((r) => {
            const list = (r[AWARDED_ACHIEVEMENTS_KEY] as string[]) || [];
            awardedRef.current = new Set(list);
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
        <div className="space-y-6 pt-6 animate-fade-in-up max-w-4xl pb-20">
            <div>
                <p className="focuz-section-label">Progress</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Focuz Progression</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Level up from sessions, streaks, habits, and resisting distractions.
                </p>
            </div>

            {progression && <FocusLevelCard progression={progression} />}

            <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Rank milestones</h2>
                <div className="flex flex-wrap gap-2">
                    {FOCUS_RANKS.map((rank) => (
                        <span
                            key={rank.level}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150 ${
                                rank.level <= currentLevel
                                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                                    : 'border-white/[0.06] bg-white/[0.02] text-neutral-600'
                            }`}
                        >
                            Lv {rank.level} · {rank.name}
                        </span>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-5">
                <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-sm font-semibold text-white">Achievements</h2>
                    <span className="text-xs text-neutral-500 tabular-nums">
                        <span className="text-neutral-300 font-medium">{unlockedCount(achievements)}</span>
                        {' '}/ {achievements.length} unlocked
                    </span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-5">
                    <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${(unlockedCount(achievements) / achievements.length) * 100}%` }}
                    />
                </div>

                {unlocked.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                        {unlocked.map((a) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                            >
                                <div className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg">
                                    {a.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                                    <p className="text-[11px] text-neutral-500 truncate">{a.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {locked.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {locked.slice(0, 6).map((a) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] opacity-50 grayscale"
                            >
                                <div className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg">
                                    {a.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                                    <p className="text-[11px] text-neutral-500 truncate">{a.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-5">
                <p className="text-xs text-neutral-500 leading-relaxed tabular-nums">
                    Focuz score:{' '}
                    <span className="font-semibold" style={{ color: focusScoreColor(focusScore) }}>
                        {focusScore}/100
                    </span>
                    {' '}· Streak: {streak} days · Dashboard: {dashboardStreak} days · Deep work: {hoursFocused}h
                </p>
            </div>
        </div>
    );
}

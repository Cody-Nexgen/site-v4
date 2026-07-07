import { useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '../lib/store';
import { GlassCard } from './OptionsApp';
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
        <div className="space-y-8 pt-6 animate-fade-in-up max-w-4xl pb-20">
            <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Progress</p>
                <h1 className="text-4xl font-black text-white tracking-tighter">Focus Progression</h1>
                <p className="text-neutral-400 mt-2 text-sm">
                    Level up from sessions, streaks, habits, and resisting distractions.
                </p>
            </div>

            {progression && <FocusLevelCard progression={progression} />}

            <GlassCard className="p-5">
                <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Rank Milestones</h2>
                <div className="flex flex-wrap gap-2">
                    {FOCUS_RANKS.map((rank) => (
                        <span
                            key={rank.level}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                                rank.level <= currentLevel
                                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                                    : 'border-white/5 bg-white/[0.02] text-neutral-600'
                            }`}
                        >
                            Lv {rank.level} · {rank.name}
                        </span>
                    ))}
                </div>
            </GlassCard>

            <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">Achievements</span>
                    <span className="text-sm text-purple-400 font-bold">
                        {unlockedCount(achievements)} / {achievements.length}
                    </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-6">
                    <div
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all"
                        style={{ width: `${(unlockedCount(achievements) / achievements.length) * 100}%` }}
                    />
                </div>

                {unlocked.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        {unlocked.map((a) => (
                            <div
                                key={a.id}
                                className="p-4 text-center rounded-xl border border-purple-500/25 bg-purple-500/5"
                            >
                                <span className="text-2xl block mb-1">{a.icon}</span>
                                <p className="text-xs font-black text-white">{a.title}</p>
                            </div>
                        ))}
                    </div>
                )}

                {locked.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {locked.slice(0, 6).map((a) => (
                            <div key={a.id} className="p-4 text-center rounded-xl border border-white/5 opacity-50 grayscale">
                                <span className="text-2xl block mb-1">{a.icon}</span>
                                <p className="text-xs font-black text-white">{a.title}</p>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            <GlassCard className="p-5 border-white/5">
                <p className="text-xs text-neutral-500 leading-relaxed">
                    Focus score:{' '}
                    <span className="font-bold" style={{ color: focusScoreColor(focusScore) }}>
                        {focusScore}/100
                    </span>
                    {' '}· Streak: {streak} days · Dashboard: {dashboardStreak} days · Deep work: {hoursFocused}h
                </p>
            </GlassCard>
        </div>
    );
}

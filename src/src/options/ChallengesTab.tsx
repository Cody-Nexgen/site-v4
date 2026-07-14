import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Zap, Trophy, RefreshCw, Check } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { computeFocusScore } from '../lib/focusScore';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { computeChallengeProgress } from '../lib/challenges';

export default function ChallengesTab() {
    const { engineState, last7DaysStats, dashboardStreak } = useAuthStore();
    const { progression, refresh } = useFocusProgression();
    const [notice, setNotice] = useState('');

    const todayIdx = (last7DaysStats?.length ?? 1) - 1;
    const todayData = todayIdx >= 0 ? last7DaysStats?.[todayIdx] : undefined;
    const planner = engineState.dailyPlanner ?? [];
    const habits = engineState.habits ?? [];

    const focusScore = useMemo(
        () =>
            computeFocusScore({
                todaySites: todayData?.sites,
                todayTotalMs: todayData?.total,
                blockedToday: engineState.blockedToday,
                dailyPlanner: planner,
                habits,
                streak: dashboardStreak,
            }).score,
        [todayData, engineState.blockedToday, planner, habits, dashboardStreak],
    );

    useEffect(() => {
        void sendProgressionMessage({ type: 'SET_CHALLENGE_FOCUS_SCORE', focusScore });
    }, [focusScore]);

    const challenges = useMemo(
        () =>
            progression
                ? computeChallengeProgress(progression, {
                      dashboardStreak,
                      focusScore,
                      habitsCount: habits.length,
                  })
                : [],
        [progression, dashboardStreak, focusScore, habits.length],
    );

    const active = challenges.filter((c) => c.active && !c.completed);
    const available = challenges.filter((c) => !c.active && !c.completed && !c.id.startsWith('dyn_'));
    const completed = challenges.filter((c) => c.completed);
    const dynamic = challenges.filter((c) => c.id.startsWith('dyn_') && !c.completed && !c.active);

    const startChallenge = async (def: (typeof challenges)[number]) => {
        await sendProgressionMessage({
            type: 'START_CHALLENGE',
            challengeId: def.id,
            challenge: {
                id: def.id,
                title: def.title,
                description: def.description,
                icon: def.icon,
                metric: def.metric,
                target: def.target,
                xpReward: def.xpReward,
                coinReward: def.coinReward,
            },
        });
        setNotice('Challenge started.');
        await refresh();
        window.setTimeout(() => setNotice(''), 2500);
    };

    if (!progression) {
        return (
            <div className="pt-6 max-w-3xl">
                <div className="h-8 w-40 rounded-lg bg-white/[0.04] animate-pulse" />
                <div className="mt-6 space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pt-6 animate-fade-in-up max-w-3xl pb-20">
            <div>
                <p className="focuz-section-label mb-1">Progress</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Challenges</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Behavior-based goals — complete focus sessions, hold streaks, and resist blocks to earn XP and coins.
                </p>
            </div>

            {notice && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm font-medium text-emerald-300">
                    {notice}
                </div>
            )}

            {active.length > 0 && (
                <section>
                    <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Zap size={12} className="text-amber-400" /> In progress
                    </h2>
                    <div className="space-y-2">
                        {active.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} active />
                        ))}
                    </div>
                </section>
            )}

            {dynamic.length > 0 && (
                <section>
                    <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <RefreshCw size={12} className="text-purple-400" /> This week
                    </h2>
                    <div className="space-y-2">
                        {dynamic.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} onStart={() => void startChallenge(c)} />
                        ))}
                    </div>
                </section>
            )}

            {available.length > 0 && (
                <section>
                    <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Target size={12} /> Milestones
                    </h2>
                    <div className="space-y-2">
                        {available.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} onStart={() => void startChallenge(c)} />
                        ))}
                    </div>
                </section>
            )}

            {completed.length > 0 && (
                <section>
                    <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Trophy size={12} className="text-emerald-400" /> Completed
                    </h2>
                    <div className="space-y-2">
                        {completed.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} done />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function ChallengeCard({
    challenge: c,
    onStart,
    active,
    done,
}: {
    challenge: ReturnType<typeof computeChallengeProgress>[number];
    onStart?: () => void;
    active?: boolean;
    done?: boolean;
}) {
    const isDynamic = c.id.startsWith('dyn_');
    return (
        <motion.div
            layout
            className={`rounded-2xl border bg-[#0c0c0e] p-4 sm:p-5 transition-colors duration-150 ${
                done ? 'border-white/[0.04] opacity-70' : 'border-white/[0.06] hover:border-white/[0.1]'
            }`}
        >
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg shrink-0">
                    {done ? <Check size={18} className="text-emerald-400" /> : c.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm">{c.title}</h3>
                        {isDynamic && !done && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/[0.12] text-purple-300">
                                Weekly
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-neutral-500 mt-0.5">{c.description}</p>
                    {!done && (
                        <>
                            <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${active ? 'bg-purple-500' : 'bg-neutral-600'}`}
                                    style={{ width: `${c.progressPct}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-1.5 tabular-nums">
                                {c.current} / {c.target}
                                <span className="text-neutral-600"> · {c.xpReward} XP · {c.coinReward} coins</span>
                            </p>
                        </>
                    )}
                    {done && (
                        <p className="text-[11px] text-neutral-600 mt-1.5">
                            Earned {c.xpReward} XP · {c.coinReward} coins
                        </p>
                    )}
                </div>
                {!done && !active && onStart && (
                    <button
                        type="button"
                        onClick={onStart}
                        className="shrink-0 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors duration-150"
                    >
                        Start
                    </button>
                )}
                {active && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-amber-400 px-2 py-1">
                        Active
                    </span>
                )}
            </div>
        </motion.div>
    );
}

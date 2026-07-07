import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Zap, Trophy, RefreshCw } from 'lucide-react';
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
    const available = challenges.filter((c) => !c.active && !c.completed);
    const completed = challenges.filter((c) => c.completed);
    const dynamic = challenges.filter((c) => c.id.startsWith('dyn_'));

    const startChallenge = async (id: string) => {
        await sendProgressionMessage({ type: 'START_CHALLENGE', challengeId: id });
        setNotice('Challenge accepted — go earn it.');
        await refresh();
        window.setTimeout(() => setNotice(''), 3000);
    };

    return (
        <div className="space-y-8 pt-6 animate-fade-in-up max-w-4xl pb-20">
            <div>
                <p className="focuz-section-label mb-1">Gamification</p>
                <h1 className="text-4xl font-black text-white tracking-tighter">Challenges</h1>
                <p className="text-neutral-400 mt-2 text-sm max-w-xl">
                    Static milestones plus fresh weekly goals generated from your focus habits.
                </p>
            </div>

            {notice && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-300">
                    {notice}
                </div>
            )}

            {dynamic.length > 0 && (
                <section>
                    <h2 className="text-xs font-black text-sky-400/90 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <RefreshCw size={12} /> This week&apos;s dynamic goals
                    </h2>
                    <div className="grid gap-3">
                        {dynamic.filter((c) => !c.completed).map((c) => (
                            <ChallengeCard key={c.id} challenge={c} onStart={() => void startChallenge(c.id)} />
                        ))}
                    </div>
                </section>
            )}

            {active.length > 0 && (
                <section>
                    <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap size={12} /> Active
                    </h2>
                    <div className="grid gap-3">
                        {active.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} active />
                        ))}
                    </div>
                </section>
            )}

            {available.length > 0 && (
                <section>
                    <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Target size={12} /> Available
                    </h2>
                    <div className="grid gap-3">
                        {available.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} onStart={() => void startChallenge(c.id)} />
                        ))}
                    </div>
                </section>
            )}

            {completed.length > 0 && (
                <section>
                    <h2 className="text-xs font-black text-emerald-400/80 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Trophy size={12} /> Completed
                    </h2>
                    <div className="grid gap-3 opacity-80">
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
        <motion.div layout className="focuz-surface-card p-4 sm:p-5">
            <div className="flex items-start gap-4">
                <span className="text-2xl">{c.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white">{c.title}</h3>
                        {isDynamic && (
                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/25">
                                Dynamic
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-neutral-400 mt-1">{c.description}</p>
                    <div className="mt-3 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : active ? 'bg-amber-400' : 'bg-sky-500'}`}
                            style={{ width: `${c.progressPct}%` }}
                        />
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1.5">
                        {c.current} / {c.target} · +{c.xpReward} XP · +{c.coinReward} coins
                    </p>
                </div>
                {!done && !active && onStart && (
                    <button
                        type="button"
                        onClick={onStart}
                        className="shrink-0 px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-bold hover:bg-sky-500/30"
                    >
                        Start
                    </button>
                )}
            </div>
        </motion.div>
    );
}

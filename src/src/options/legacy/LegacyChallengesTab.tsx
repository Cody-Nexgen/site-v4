// LEGACY: pre-revamp version kept so it can be picked per page in Settings → Page versions.
// Copied from options/ChallengesTab.tsx; imports rewritten. Keep behavior changes out of this file.
import { useMemo, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Target, Zap, Trophy, RefreshCw, Check, Ban, Brain, Timer, GraduationCap, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { computeFocusScore } from '../../lib/focusScore';
import {
    useFocusProgression,
    scheduleChallengeFocusScore,
    sendProgressionMessage,
} from '../../hooks/useFocusProgression';
import {
    computeChallengeProgress,
    hasCompletedChallenge,
    hasPersistedChallengeStart,
    isChallengeStartResponseStaleOrPartial,
    type ChallengeStartResponse,
} from '../../lib/challenges';

export default function ChallengesTab() {
    const { engineState, last7DaysStats, dashboardStreak } = useAuthStore();
    const { progression, refresh } = useFocusProgression();
    const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
    const [startPhases, setStartPhases] = useState<Record<string, 'check' | 'started'>>({});
    const [startingIds, setStartingIds] = useState<Record<string, boolean>>({});

    const todayIdx = (last7DaysStats?.length ?? 1) - 1;
    const todayData = todayIdx >= 0 ? last7DaysStats?.[todayIdx] : undefined;
    const planner = useMemo(() => engineState.dailyPlanner ?? [], [engineState.dailyPlanner]);
    const habits = useMemo(() => engineState.habits ?? [], [engineState.habits]);

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
        return scheduleChallengeFocusScore(focusScore);
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
        if (startPhases[def.id] || startingIds[def.id] || def.active || def.completed) return;
        setStartingIds((current) => ({ ...current, [def.id]: true }));
        try {
            const response = await sendProgressionMessage<ChallengeStartResponse>({
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
                    periodKind: def.periodKind,
                    periodKey: def.periodKey,
                },
            });
            const staleOrPartial = isChallengeStartResponseStaleOrPartial(response, def.id);
            let authoritative = response;
            try {
                let reloaded = await refresh();
                // A timed-out/closed response does not cancel the background write.
                // Give that write a brief chance to settle before declaring failure.
                if (
                    staleOrPartial &&
                    !reloaded.activeChallenges.some((challenge) => challenge.id === def.id) &&
                    !reloaded.completedChallenges.includes(def.id)
                ) {
                    await new Promise((resolve) => window.setTimeout(resolve, 150));
                    reloaded = await refresh();
                }
                authoritative = { ...response, progression: reloaded };
            } catch (reloadError) {
                console.warn('[Challenges] Could not verify challenge storage after response:', {
                    challengeId: def.id,
                    response,
                    reloadError,
                });
            }

            // Supabase is the durable source of truth: even if the local chrome.storage read
            // above raced (e.g. a suspended service worker), a cloud confirmation means the
            // challenge really did start and the UI should not report a false failure.
            const persistedActive = hasPersistedChallengeStart(authoritative, def.id) || response.cloudPersisted === true;
            const completed = hasCompletedChallenge(authoritative, def.id);
            if (completed || response.reason === 'completed') {
                setNotice({ text: 'This challenge is already completed.', error: false });
                return;
            }
            if (!persistedActive) {
                const detail = response.error ?? response.reason ?? 'No active challenge was found in storage.';
                console.error('[Challenges] START_CHALLENGE did not persist:', {
                    challengeId: def.id,
                    response,
                    authoritativeProgression: authoritative.progression,
                });
                setNotice({ text: `Could not start challenge: ${detail}`, error: true });
                return;
            }

            setStartPhases((current) => ({ ...current, [def.id]: 'check' }));
            setNotice({
                text: response.reason === 'already_active' || response.started === false
                    ? 'Challenge is already active.'
                    : 'Challenge started.',
                error: false,
            });
            window.setTimeout(() => {
                setStartPhases((current) => ({ ...current, [def.id]: 'started' }));
            }, 3000);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.error('[Challenges] Unexpected challenge start failure:', {
                challengeId: def.id,
                error,
            });
            setNotice({ text: `Could not start challenge: ${detail}`, error: true });
        } finally {
            setStartingIds((current) => ({ ...current, [def.id]: false }));
            window.setTimeout(() => setNotice(null), 2500);
        }
    };

    if (!progression) {
        return (
            <div>
                <div className="h-8 w-40 rounded-lg bg-white/4 animate-pulse" />
                <div className="mt-6 space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 rounded-lg bg-white/4 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">

            {notice && (
                <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                    notice.error
                        ? 'border-red-500/30 bg-red-500/[0.09] text-red-300'
                        : 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300'
                }`}>
                    {notice.text}
                </div>
            )}

            {active.length > 0 && (
                <section>
                    <h2 className="text-meta text-[var(--fz-text-3)] mb-3 flex items-center gap-1.5">
                        <Zap size={12} className="text-[var(--fz-warning)]" /> In progress
                    </h2>
                    <div className="space-y-2">
                        {active.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} active startPhase={startPhases[c.id]} />
                        ))}
                    </div>
                </section>
            )}

            {dynamic.length > 0 && (
                <section>
                    <h2 className="text-meta text-[var(--fz-text-3)] mb-3 flex items-center gap-1.5">
                        <RefreshCw size={12} className="text-blue-400" /> This week
                    </h2>
                    <div className="space-y-2">
                        {dynamic.map((c) => (
                            <ChallengeCard
                                key={c.id}
                                challenge={c}
                                startPhase={startPhases[c.id]}
                                starting={startingIds[c.id]}
                                onStart={() => void startChallenge(c)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {available.length > 0 && (
                <section>
                    <h2 className="text-meta text-[var(--fz-text-3)] mb-3 flex items-center gap-1.5">
                        <Target size={12} /> Milestones
                    </h2>
                    <div className="space-y-2">
                        {available.map((c) => (
                            <ChallengeCard
                                key={c.id}
                                challenge={c}
                                startPhase={startPhases[c.id]}
                                starting={startingIds[c.id]}
                                onStart={() => void startChallenge(c)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {completed.length > 0 && (
                <details className="group">
                    <summary className="text-meta text-[var(--fz-text-3)] mb-3 flex items-center gap-1.5 cursor-pointer select-none list-none">
                        <Trophy size={12} className="text-[var(--fz-success)]" /> Completed ({completed.length})
                    </summary>
                    <div className="space-y-2">
                        {completed.map((c) => (
                            <ChallengeCard key={c.id} challenge={c} done />
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

const CHALLENGE_ICONS: Record<string, LucideIcon> = {
    no_shorts_streak: Ban,
    no_tiktok_streak: Ban,
    focus_minutes: Brain,
    total_pomodoros: Timer,
    finals_sprint: GraduationCap,
};

function ChallengeCard({
    challenge: c,
    onStart,
    active,
    done,
    startPhase,
    starting,
}: {
    challenge: ReturnType<typeof computeChallengeProgress>[number];
    onStart?: () => void;
    active?: boolean;
    done?: boolean;
    startPhase?: 'check' | 'started';
    starting?: boolean;
}) {
    const isDynamic = c.id.startsWith('dyn_');
    return (
        <motion.div
            layout
            className={`rounded-lg border bg-surface p-4 sm:p-5 transition-colors duration-150 ${
                done ? 'border-white/8 opacity-70' : 'border-white/8 hover:border-white/8'
            }`}
        >
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/4 flex items-center justify-center shrink-0">
                    {done ? (
                        <Check size={18} className="text-emerald-400" />
                    ) : (
                        (() => {
                            const Icon = CHALLENGE_ICONS[c.id] ?? CHALLENGE_ICONS[c.metric] ?? Zap;
                            return <Icon size={18} className="text-neutral-300" />;
                        })()
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm">{c.title}</h3>
                        {isDynamic && !done && (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-lg bg-[var(--fz-accent-soft)] text-[var(--fz-accent)]">
                                Weekly
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-neutral-500 mt-0.5">{c.description}</p>
                    {!done && (
                        <>
                            <div className="mt-3 h-1.5 rounded-full bg-white/6 overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full ${active ? 'bg-[var(--fz-accent)]' : 'bg-neutral-600'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${c.progressPct}%` }}
                                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                />
                            </div>
                            <p className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums text-neutral-500">
                                {c.current} / {c.target}
                                <span className="rounded-md bg-[var(--fz-bg-raised)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--fz-text-3)]">{c.xpReward} XP</span>
                                <span className="rounded-md bg-[var(--fz-bg-raised)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--fz-text-3)]">{c.coinReward} coins</span>
                            </p>
                        </>
                    )}
                    {done && (
                        <p className="text-[11px] text-neutral-600 mt-1.5">
                            Earned {c.xpReward} XP · {c.coinReward} coins
                        </p>
                    )}
                </div>
                {startPhase ? (
                    <motion.div
                        layout
                        initial={{ x: -44, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="relative flex h-8 w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-emerald-950"
                    >
                        <AnimatePresence initial={false} mode="sync">
                            {startPhase === 'check' ? (
                                <motion.span
                                    key="check"
                                    initial={{ x: -32, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 34, opacity: 0 }}
                                    transition={{ duration: 0.14, ease: [0.4, 0, 1, 1] }}
                                    className="absolute"
                                >
                                    <Check size={17} strokeWidth={2.8} />
                                </motion.span>
                            ) : (
                                <motion.span
                                    key="started"
                                    initial={{ x: -32, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    Started
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ) : !done && !active && onStart ? (
                    <button
                        type="button"
                        onClick={onStart}
                        disabled={starting}
                        className="shrink-0 px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200 disabled:cursor-wait disabled:opacity-60 transition-colors duration-150"
                    >
                        {starting ? 'Starting…' : 'Start'}
                    </button>
                ) : active ? (
                    <span className="flex h-8 w-[82px] shrink-0 items-center justify-center rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-emerald-950">
                        Started
                    </span>
                ) : done ? (
                    <span className="flex h-8 w-[82px] shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300">
                        Finished
                    </span>
                ) : null}
            </div>
        </motion.div>
    );
}

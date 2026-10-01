import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Ban,
    Brain,
    CalendarDays,
    Check,
    ChevronDown,
    Clock,
    Flame,
    GraduationCap,
    Mountain,
    Sun,
    Target,
    Timer,
    TrendingUp,
    Trophy,
    Waves,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { computeFocusScore } from '../lib/focusScore';
import {
    useFocusProgression,
    scheduleChallengeFocusScore,
    sendProgressionMessage,
} from '../hooks/useFocusProgression';
import {
    computeChallengeProgress,
    hasCompletedChallenge,
    hasPersistedChallengeStart,
    isChallengeStartResponseStaleOrPartial,
    type ChallengeStartResponse,
} from '../lib/challenges';
import { GlassCard } from './OptionsApp';
import { Banner } from '../components/fz/Banner';
import { Button } from '../components/fz/Button';
import { ProgressRing } from '../components/fz/ProgressRing';

type Challenge = ReturnType<typeof computeChallengeProgress>[number];

const ICONS: Record<string, LucideIcon> = {
    no_shorts_streak: Ban,
    no_tiktok_streak: Ban,
    focus_minutes: Brain,
    total_pomodoros: Timer,
    week_pomodoros: Zap,
    today_pomodoros: Flame,
    focus_score: TrendingUp,
    finals: GraduationCap,
    deep_start: Waves,
    deep_climb: Mountain,
    fallback: Target,
};

/** Key into ICONS for a challenge (special ids first, then its metric). */
function iconKey(c: Challenge): string {
    if (c.id === 'finals_sprint') return 'finals';
    if (c.id.startsWith('dyn_deep_5h')) return 'deep_start';
    if (c.id.startsWith('dyn_deep_next')) return 'deep_climb';
    return c.metric in ICONS ? c.metric : 'fallback';
}

const COUNTS_FROM_START = new Set(['focus_minutes', 'total_pomodoros', 'week_pomodoros', 'today_pomodoros']);

/** "3 of 7 days", "12.5 of 30 hours", "2 of 5 sessions". */
function progressText(c: Challenge): string {
    switch (c.metric) {
        case 'no_shorts_streak':
        case 'no_tiktok_streak':
            return `${c.current} of ${c.target} days`;
        case 'focus_minutes': {
            if (c.target < 120) return `${Math.round(c.current)} of ${c.target} min`;
            const h = (m: number) => (Math.round((m / 60) * 10) / 10).toString();
            return `${h(c.current)} of ${h(c.target)} hours`;
        }
        case 'focus_score':
            return `${c.current} of ${c.target} points`;
        default:
            return `${c.current} of ${c.target} ${c.target === 1 ? 'session' : 'sessions'}`;
    }
}

/** Time left in a daily / weekly challenge (weeks end Sunday night). */
function timeLeft(c: Challenge, now: Date): string | null {
    if (c.periodKind === 'day') {
        const end = new Date(now);
        end.setHours(24, 0, 0, 0);
        const hours = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 3600000));
        return hours <= 1 ? 'Ends within the hour' : `Ends in ${hours}h`;
    }
    if (c.periodKind === 'week') {
        const daysLeft = (7 - now.getDay()) % 7; // days until Sunday
        return daysLeft === 0 ? 'Ends tonight' : daysLeft === 1 ? 'Ends tomorrow' : `Ends in ${daysLeft} days`;
    }
    return null;
}

function Section({ icon: Icon, title, meta, children }: { icon: LucideIcon; title: string; meta?: string; children: ReactNode }) {
    return (
        <section>
            <div className="mb-2.5 flex items-baseline gap-2 px-0.5">
                <Icon size={14} className="translate-y-0.5 text-[var(--fz-text-3)]" />
                <h2 className="text-[14px] font-semibold text-[var(--fz-text-1)]">{title}</h2>
                {meta && <span className="text-meta">{meta}</span>}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>
        </section>
    );
}

export default function ChallengesTab() {
    const { engineState, last7DaysStats, dashboardStreak } = useAuthStore();
    const { progression, refresh } = useFocusProgression();
    const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
    const [startPhases, setStartPhases] = useState<Record<string, 'check' | 'started'>>({});
    const [startingIds, setStartingIds] = useState<Record<string, boolean>>({});
    const [showDone, setShowDone] = useState(false);
    const [now] = useState(() => new Date());

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
    const open = challenges.filter((c) => !c.active && !c.completed);
    const today = open.filter((c) => c.periodKind === 'day');
    const week = open.filter((c) => c.periodKind === 'week');
    const milestones = open.filter((c) => !c.periodKind);
    const completed = challenges.filter((c) => c.completed);
    const earnedXp = completed.reduce((s, c) => s + (c.xpReward || 0), 0);
    const earnedCoins = completed.reduce((s, c) => s + (c.coinReward || 0), 0);

    const startChallenge = async (def: Challenge) => {
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
            const isCompleted = hasCompletedChallenge(authoritative, def.id);
            if (isCompleted || response.reason === 'completed') {
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
                text:
                    response.reason === 'already_active' || response.started === false
                        ? 'That challenge is already running.'
                        : `Started “${def.title}”. Progress counts from now.`,
                error: false,
            });
            window.setTimeout(() => {
                setStartPhases((current) => ({ ...current, [def.id]: 'started' }));
            }, 1600);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.error('[Challenges] Unexpected challenge start failure:', { challengeId: def.id, error });
            setNotice({ text: `Could not start challenge: ${detail}`, error: true });
        } finally {
            setStartingIds((current) => ({ ...current, [def.id]: false }));
            window.setTimeout(() => setNotice(null), 3200);
        }
    };

    if (!progression) {
        return (
            <div className="space-y-4">
                <div className="h-[92px] animate-pulse rounded-[10px] bg-[var(--fz-bg-hover)]" />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-[128px] animate-pulse rounded-[10px] bg-[var(--fz-bg-hover)]" />
                    ))}
                </div>
            </div>
        );
    }

    const card = (c: Challenge) => (
        <ChallengeCard
            key={c.id}
            c={c}
            now={now}
            startPhase={startPhases[c.id]}
            starting={!!startingIds[c.id]}
            onStart={() => void startChallenge(c)}
        />
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            {notice && (
                <Banner tone={notice.error ? 'danger' : 'info'} onDismiss={() => setNotice(null)}>
                    {notice.text}
                </Banner>
            )}

            {/* Summary */}
            <GlassCard>
                <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-[var(--fz-border)]">
                    {[
                        { label: 'In progress', value: active.length, sub: active.length ? 'Keep going' : 'Start one below' },
                        { label: 'Up for grabs', value: open.length, sub: `${today.length} today · ${week.length} this week` },
                        { label: 'Completed', value: completed.length, sub: completed.length ? 'Nice work' : 'None yet' },
                        { label: 'Earned', value: `${earnedXp.toLocaleString()} XP`, sub: `${earnedCoins.toLocaleString()} coins from challenges` },
                    ].map((s) => (
                        <div key={s.label} className="px-5 py-4">
                            <p className="text-meta">{s.label}</p>
                            <p className="mt-0.5 text-[22px] font-semibold leading-7 tabular-nums text-[var(--fz-text-1)]">{s.value}</p>
                            <p className="text-meta mt-0.5 truncate">{s.sub}</p>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {active.length > 0 && (
                <Section icon={Zap} title="In progress" meta={`${active.length} running`}>
                    {active.map(card)}
                </Section>
            )}

            {today.length > 0 && (
                <Section icon={Sun} title="Today" meta="Resets at midnight">
                    {today.map(card)}
                </Section>
            )}

            {week.length > 0 && (
                <Section icon={CalendarDays} title="This week" meta="Resets Sunday night">
                    {week.map(card)}
                </Section>
            )}

            {milestones.length > 0 && (
                <Section icon={Target} title="Milestones" meta="Big goals — no deadline">
                    {milestones.map(card)}
                </Section>
            )}

            {completed.length > 0 && (
                <section>
                    <button
                        type="button"
                        onClick={() => setShowDone((v) => !v)}
                        aria-expanded={showDone}
                        className="mb-2.5 flex items-center gap-2 px-0.5 text-left"
                    >
                        <Trophy size={14} className="text-[var(--fz-text-3)]" />
                        <span className="text-[14px] font-semibold text-[var(--fz-text-1)]">Completed</span>
                        <span className="text-meta">{completed.length}</span>
                        <ChevronDown size={14} className={`text-[var(--fz-text-4)] transition-transform ${showDone ? 'rotate-180' : ''}`} />
                    </button>
                    {showDone && (
                        <GlassCard>
                            <div className="divide-y divide-[var(--fz-border)]">
                                {completed.map((c) => {
                                    const Icon = ICONS[iconKey(c)];
                                    return (
                                        <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--fz-text-1)] text-[var(--fz-bg-app)]">
                                                <Icon size={15} strokeWidth={1.9} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px] font-medium text-[var(--fz-text-1)]">{c.title}</span>
                                                <span className="text-meta block truncate">{c.description}</span>
                                            </span>
                                            <span className="shrink-0 text-right text-[12px] tabular-nums text-[var(--fz-text-3)]">
                                                +{c.xpReward} XP · +{c.coinReward} coins
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    )}
                </section>
            )}
        </div>
    );
}

function ChallengeCard({
    c,
    now,
    onStart,
    startPhase,
    starting,
}: {
    c: Challenge;
    now: Date;
    onStart: () => void;
    startPhase?: 'check' | 'started';
    starting: boolean;
}) {
    const Icon = ICONS[iconKey(c)];
    const running = c.active || startPhase === 'started';
    const left = timeLeft(c, now);
    // Session/deep-work challenges only count what happens after Start.
    const countsFromStart = COUNTS_FROM_START.has(c.metric);
    const shown = c.active || !countsFromStart ? c : { ...c, current: 0, progressPct: 0 };

    return (
        <GlassCard className="p-4">
            <div className="flex items-start gap-3.5">
                {running ? (
                    <ProgressRing value={shown.progressPct / 100} size={46} stroke={3.5}>
                        <Icon size={17} strokeWidth={1.9} className="text-[var(--fz-text-1)]" />
                    </ProgressRing>
                ) : (
                    <span className="flex size-[46px] shrink-0 items-center justify-center rounded-xl bg-[var(--fz-bg-hover)] text-[var(--fz-text-2)]">
                        <Icon size={19} strokeWidth={1.9} />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[var(--fz-text-1)]">{c.title}</p>
                            <p className="text-meta mt-0.5 line-clamp-2">{c.description}</p>
                        </div>
                        <div className="shrink-0">
                            {startPhase ? (
                                <motion.span
                                    layout
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="relative flex h-7 w-[76px] items-center justify-center overflow-hidden rounded-md bg-[var(--fz-text-1)] text-[12.5px] font-semibold text-[var(--fz-bg-app)]"
                                >
                                    <AnimatePresence initial={false} mode="popLayout">
                                        {startPhase === 'check' ? (
                                            <motion.span
                                                key="check"
                                                initial={{ y: 10, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -10, opacity: 0 }}
                                            >
                                                <Check size={15} strokeWidth={3} />
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                key="started"
                                                initial={{ y: 10, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                            >
                                                Started
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.span>
                            ) : c.active ? (
                                <span className="flex items-center gap-1 rounded-md bg-[var(--fz-bg-hover)] px-2 py-1 text-[11.5px] font-medium tabular-nums text-[var(--fz-text-2)]">
                                    {left ? (
                                        <>
                                            <Clock size={11} />
                                            {left.replace('Ends in ', '')}
                                        </>
                                    ) : (
                                        `${shown.progressPct}%`
                                    )}
                                </span>
                            ) : (
                                <Button variant="primary" size="sm" loading={starting} onClick={onStart}>
                                    Start
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                            <motion.span
                                className={`block h-full rounded-full ${running ? 'bg-[var(--fz-text-1)]' : 'bg-[var(--fz-text-3)]'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(shown.progressPct > 0 ? 3 : 0, shown.progressPct)}%` }}
                                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            />
                        </span>
                        <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--fz-text-3)]">{progressText(shown)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="tabular-nums text-[var(--fz-text-2)]">
                            <span className="font-semibold text-[var(--fz-text-1)]">+{c.xpReward} XP</span>
                            <span className="text-[var(--fz-text-4)]"> · </span>+{c.coinReward} coins
                        </span>
                        {!running && (left || countsFromStart) && (
                            <span className="text-[var(--fz-text-4)]">
                                {[left, countsFromStart ? 'counts from Start' : null].filter(Boolean).join(' · ')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}

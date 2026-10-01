import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Check,
    Coins,
    Crown,
    Flame,
    Gem,
    Lock,
    ShieldCheck,
    Sparkles,
    Target,
    Timer,
    Trophy,
    TrendingUp,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { computeAchievements, unlockedCount, type Achievement } from '../lib/achievements';
import { computeFocusScore } from '../lib/focusScore';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { EVENT_REWARDS, FOCUS_RANKS, getLevelProgress, milestoneLabel } from '../lib/focusProgression';
import { GlassCard } from './OptionsApp';
import { ProgressRing } from '../components/fz/ProgressRing';
import { SegmentedControl } from '../components/fz/SegmentedControl';

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

const XP_WAYS: { label: string; hint?: string; event: keyof typeof EVENT_REWARDS; icon: LucideIcon }[] = [
    { label: 'Finish a Pomodoro', event: 'pomodoro_complete', icon: Timer },
    { label: 'Check in a habit', event: 'habit_checkin', icon: TrendingUp },
    { label: 'Unlock an achievement', event: 'achievement_unlock', icon: Trophy },
    { label: 'Keep your daily streak', event: 'daily_streak', icon: Flame },
    { label: 'Resist a blocked site', hint: 'up to 10 a day', event: 'block_resisted', icon: ShieldCheck },
];

function CardHeader({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-[var(--fz-text-1)]">{title}</h3>
                {meta && <p className="text-meta mt-0.5">{meta}</p>}
            </div>
            {action}
        </div>
    );
}

function AchievementCard({ a, fresh }: { a: Achievement; fresh: boolean }) {
    const Icon = ACHIEVEMENT_ICONS[a.id] ?? Sparkles;
    const target = a.target ?? 1;
    const progress = a.progress ?? (a.unlocked ? target : 0);
    const pct = Math.round((progress / target) * 100);
    return (
        <div
            className={`relative flex gap-3.5 overflow-hidden rounded-[10px] border p-4 transition-colors ${
                a.unlocked
                    ? 'border-[var(--fz-border-strong)] bg-[var(--fz-bg-raised)]'
                    : 'border-[var(--fz-border)] bg-transparent'
            }`}
        >
            {fresh && <span className="fz-achievement-shimmer" aria-hidden />}
            <span
                className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl ${
                    a.unlocked
                        ? 'bg-[var(--fz-text-1)] text-[var(--fz-bg-app)]'
                        : 'border border-dashed border-[var(--fz-border-strong)] text-[var(--fz-text-4)]'
                }`}
            >
                <Icon size={20} strokeWidth={1.9} />
                {!a.unlocked && (
                    <span className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full border-2 border-[var(--fz-bg-panel)] bg-[var(--fz-bg-active)] text-[var(--fz-text-3)]">
                        <Lock size={9} strokeWidth={2.5} />
                    </span>
                )}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <p className={`truncate text-[13.5px] font-semibold ${a.unlocked ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-2)]'}`}>
                        {a.title}
                    </p>
                    {a.unlocked ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--fz-bg-hover)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--fz-text-2)]">
                            <Check size={10} strokeWidth={2.75} />
                            Done
                        </span>
                    ) : (
                        <span className="shrink-0 text-[11px] tabular-nums text-[var(--fz-text-4)]">+{EVENT_REWARDS.achievement_unlock.xp} XP</span>
                    )}
                </div>
                <p className="text-meta mt-0.5 line-clamp-2">{a.description}</p>
                {!a.unlocked && (
                    <div className="mt-2.5 flex items-center gap-2.5">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                            <span
                                className="block h-full rounded-full bg-[var(--fz-text-2)] transition-[width] duration-500"
                                style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }}
                            />
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-[var(--fz-text-3)]">
                            {progress} of {target} {a.unit ?? ''}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AchievementsTab() {
    const { engineState, last7DaysStats, dashboardStreak, bestStreak } = useAuthStore();
    const { progression, refresh } = useFocusProgression();
    const awardedRef = useRef<Set<string>>(new Set());
    const [seenIds, setSeenIds] = useState<Set<string> | null>(null);
    const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

    useEffect(() => {
        chrome.storage.local.get(AWARDED_ACHIEVEMENTS_KEY).then((r) => {
            const list = (r[AWARDED_ACHIEVEMENTS_KEY] as string[]) || [];
            awardedRef.current = new Set(list);
            setSeenIds(new Set(list));
        });
    }, []);

    const todayIdx = (last7DaysStats?.length ?? 1) - 1;
    const todayData = todayIdx >= 0 ? last7DaysStats?.[todayIdx] : undefined;
    const planner = useMemo(() => engineState.dailyPlanner ?? [], [engineState.dailyPlanner]);
    const habits = useMemo(() => engineState.habits ?? [], [engineState.habits]);

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

    // Award XP once per newly unlocked achievement.
    useEffect(() => {
        const newlyUnlocked = achievements.filter((a) => a.unlocked && !awardedRef.current.has(a.id));
        if (newlyUnlocked.length === 0) return;
        void (async () => {
            for (const a of newlyUnlocked) {
                awardedRef.current.add(a.id);
                await sendProgressionMessage({ type: 'PROGRESSION_ACHIEVEMENT', achievementId: a.id });
            }
            await chrome.storage.local.set({ [AWARDED_ACHIEVEMENTS_KEY]: Array.from(awardedRef.current) });
            await refresh();
        })();
    }, [achievements, refresh]);

    const done = unlockedCount(achievements);
    const shown = [...achievements]
        .sort((a, b) => {
            // Unlocked first, then the locked ones closest to done.
            if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
            const pa = (a.progress ?? 0) / (a.target ?? 1);
            const pb = (b.progress ?? 0) / (b.target ?? 1);
            return pb - pa;
        })
        .filter((a) => (filter === 'all' ? true : filter === 'unlocked' ? a.unlocked : !a.unlocked));

    const xp = progression?.xp ?? 0;
    const level = getLevelProgress(xp);
    const rankIndex = FOCUS_RANKS.reduce((idx, r, i) => (level.level >= r.level ? i : idx), 0);
    const nextRank = FOCUS_RANKS[rankIndex + 1];
    // Share of the way from the current rank to the next one.
    const rankSpan = nextRank ? (level.level - FOCUS_RANKS[rankIndex].level + level.progressPct / 100) / (nextRank.level - FOCUS_RANKS[rankIndex].level) : 1;
    const stats = progression?.stats;
    const hoursFocused = stats ? Math.round((stats.focusMinutesTotal / 60) * 10) / 10 : 0;

    return (
        <div className="space-y-4 animate-fade-in-up">
            {/* Level */}
            <GlassCard>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
                    <ProgressRing value={level.progressPct / 100} size={84} stroke={5}>
                        <span className="flex flex-col items-center leading-none">
                            <span className="text-[26px] font-semibold tabular-nums text-[var(--fz-text-1)]">{level.level}</span>
                            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--fz-text-4)]">Level</span>
                        </span>
                    </ProgressRing>
                    <div className="min-w-[220px] flex-1">
                        <p className="text-meta">Focuz level</p>
                        <h2 className="mt-0.5 text-[22px] font-semibold leading-7 tracking-[-0.015em] text-[var(--fz-text-1)]">
                            {level.rank}
                        </h2>
                        <div className="mt-3 flex items-center gap-3">
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                <span
                                    className="block h-full rounded-full bg-[var(--fz-text-1)] transition-[width] duration-700 ease-out"
                                    style={{ width: `${level.progressPct}%` }}
                                />
                            </span>
                            <span className="shrink-0 text-[12px] tabular-nums text-[var(--fz-text-3)]">
                                {level.isMaxLevel ? 'Max level' : `${level.xpIntoLevel} / ${level.xpForNextLevel} XP`}
                            </span>
                        </div>
                        <p className="text-meta mt-1.5">{milestoneLabel(xp)}</p>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--fz-border)] px-4 py-3">
                        <Coins size={18} className="text-[var(--fz-text-3)]" />
                        <div>
                            <p className="text-[20px] font-semibold leading-6 tabular-nums text-[var(--fz-text-1)]">{progression?.coins ?? 0}</p>
                            <p className="text-meta">coins to spend in the shop</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 border-t border-[var(--fz-border)] sm:grid-cols-5 sm:divide-x sm:divide-[var(--fz-border)]">
                    {[
                        { label: 'Total XP', value: xp.toLocaleString() },
                        { label: 'Deep work', value: `${hoursFocused}h` },
                        { label: 'Pomodoros', value: (stats?.totalPomodoros ?? 0).toLocaleString() },
                        { label: 'Blocks resisted', value: (stats?.totalBlocksResisted ?? 0).toLocaleString() },
                        { label: 'Focus score today', value: `${focusScore}` },
                    ].map((s) => (
                        <div key={s.label} className="px-5 py-3.5">
                            <p className="text-meta">{s.label}</p>
                            <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-[var(--fz-text-1)]">{s.value}</p>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {/* Rank path */}
            <GlassCard>
                <CardHeader
                    title="Rank path"
                    meta={nextRank ? `Level ${nextRank.level} unlocks ${nextRank.name}` : 'You’ve reached the top rank'}
                />
                <div className="px-5 pb-6 pt-2">
                    <div className="relative mx-3">
                        {/* track */}
                        <div className="absolute left-0 right-0 top-[13px] h-[3px] rounded-full bg-[var(--fz-bg-active)]" />
                        <div
                            className="absolute left-0 top-[13px] h-[3px] rounded-full bg-[var(--fz-text-1)] transition-[width] duration-700 ease-out"
                            style={{
                                width: `${((rankIndex + Math.min(1, Math.max(0, rankSpan))) / (FOCUS_RANKS.length - 1)) * 100}%`,
                            }}
                        />
                        <div className="relative flex justify-between">
                            {FOCUS_RANKS.map((rank, i) => {
                                const reached = level.level >= rank.level;
                                const current = i === rankIndex;
                                return (
                                    <div key={rank.level} className="flex w-0 flex-col items-center">
                                        <span
                                            className={`flex size-[29px] items-center justify-center rounded-full border-2 text-[11px] font-semibold tabular-nums transition-colors ${
                                                current
                                                    ? 'border-[var(--fz-text-1)] bg-[var(--fz-text-1)] text-[var(--fz-bg-app)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--fz-text-1)_14%,transparent)]'
                                                    : reached
                                                      ? 'border-[var(--fz-text-1)] bg-[var(--fz-text-1)] text-[var(--fz-bg-app)]'
                                                      : 'border-[var(--fz-border-strong)] bg-[var(--fz-bg-raised)] text-[var(--fz-text-4)]'
                                            }`}
                                        >
                                            {reached && !current ? <Check size={13} strokeWidth={3} /> : rank.level}
                                        </span>
                                        <span
                                            className={`mt-2 whitespace-nowrap text-[12.5px] ${
                                                current ? 'font-semibold text-[var(--fz-text-1)]' : reached ? 'text-[var(--fz-text-2)]' : 'text-[var(--fz-text-4)]'
                                            }`}
                                        >
                                            {rank.name}
                                        </span>
                                        <span className="whitespace-nowrap text-[11px] tabular-nums text-[var(--fz-text-4)]">Lv {rank.level}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                {/* Achievements */}
                <GlassCard>
                    <CardHeader
                        title="Achievements"
                        meta={`${done} of ${achievements.length} unlocked`}
                        action={
                            <SegmentedControl
                                size="sm"
                                idPrefix="ach-filter"
                                value={filter}
                                onChange={setFilter}
                                options={[
                                    { value: 'all', label: 'All' },
                                    { value: 'unlocked', label: 'Unlocked' },
                                    { value: 'locked', label: 'Locked' },
                                ]}
                            />
                        }
                    />
                    <div className="px-5">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                            <span
                                className="block h-full rounded-full bg-[var(--fz-text-1)] transition-[width] duration-700"
                                style={{ width: `${(done / Math.max(1, achievements.length)) * 100}%` }}
                            />
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 p-5 sm:grid-cols-2">
                        {shown.length === 0 ? (
                            <p className="col-span-full py-6 text-center text-[13px] text-[var(--fz-text-3)]">
                                {filter === 'unlocked' ? 'Nothing unlocked yet — your first one is close.' : 'You’ve unlocked everything. 🎉'}
                            </p>
                        ) : (
                            shown.map((a) => (
                                <AchievementCard key={a.id} a={a} fresh={seenIds !== null && a.unlocked && !seenIds.has(a.id)} />
                            ))
                        )}
                    </div>
                </GlassCard>

                {/* How to earn */}
                <GlassCard>
                    <CardHeader title="How to earn XP" meta="Every level is a little further than the last" />
                    <div className="px-3 pb-3">
                        {XP_WAYS.map((way) => {
                            const Icon = way.icon;
                            const r = EVENT_REWARDS[way.event];
                            return (
                                <div key={way.event} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--fz-bg-hover)] text-[var(--fz-text-2)]">
                                        <Icon size={15} strokeWidth={1.9} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] text-[var(--fz-text-1)]">{way.label}</span>
                                        {way.hint && <span className="text-meta block">{way.hint}</span>}
                                    </span>
                                    <span className="shrink-0 text-right">
                                        <span className="block text-[13px] font-semibold tabular-nums text-[var(--fz-text-1)]">+{r.xp} XP</span>
                                        <span className="block text-[11px] tabular-nums text-[var(--fz-text-4)]">+{r.coins} coins</span>
                                    </span>
                                </div>
                            );
                        })}
                        <p className="text-meta border-t border-[var(--fz-border)] px-2 pt-3">
                            Challenges pay out their own XP and coins — see the Challenges page.
                        </p>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

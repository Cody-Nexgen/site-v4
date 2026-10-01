import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore, type EngineState } from '../lib/store';
import { dispatchFocusComplete } from '../lib/proDashboard';
import {
    POMODORO_RUNTIME_KEY,
    completePomodoroSegmentLocal,
    computeTimeLeft,
    createResetPomodoroRuntime,
    readPomodoroRuntime,
    writePomodoroRuntime,
    type PomodoroRuntime,
} from '../lib/pomodoroRuntime';
import { GlassCard } from './OptionsApp';
import { 
    Play, Pause, RefreshCw, Plus,
    Trash, Check, Ban, Globe, Zap, X,
    AlertTriangle, TrendingDown, Lightbulb,
    ShieldOff, Loader2, ChevronDown,
    Users, Dices, Newspaper, ShoppingBag, Tv, Gamepad2, Heart,
    Sparkles, MoreHorizontal, type LucideIcon,
    Flame, Repeat, Pencil, RotateCcw,
} from 'lucide-react';
import { SegmentedControl } from '../components/fz/SegmentedControl';
import { Banner } from '../components/fz/Banner';
import { Chip } from '../components/fz/Chip';
import { Dialog } from '../components/fz/Dialog';
import { Button } from '../components/fz/Button';
import { EmptyState } from '../components/fz/EmptyState';
import { IconButton } from '../components/fz/IconButton';
import { Kbd } from '../components/fz/Kbd';
import { Menu } from '../components/fz/Menu';
import { Switch } from '../components/fz/Switch';
import { HabitCheckInButton } from '../components/pro-dashboard/HabitCheckInButton';
import { capDayScreenMs } from '../lib/screenTimeCap';
import { ChallengeModal, randomFocusPhrase } from '../lib/unblockChallenge';
import { sendProgressionMessage } from '../hooks/useFocusProgression';
import HabitNameModal from '../components/HabitNameModal';
import { FocusActivityChart } from '../components/FocusActivityChart';
import { detectProcrastinationPatterns } from '../lib/procrastinationPatterns';
import { detectOverridePatterns, type EmergencyOverrideEntry } from '../lib/emergencyOverride';
import { computeFocusScore, focusScoreColor, computeAllTimeFocusScore } from '../lib/focusScore';
import { pluralize } from '../lib/utils';
import { NuclearConfirmModal } from '../components/NuclearConfirmModal';
import SmartYouTubeModal from '../components/SmartYouTubeModal';
import { normalizeSmartYouTube, type SmartYouTubeSettings } from '../lib/youtubeSmartMode';
import {
    SAFE_BLOCK_CATEGORIES,
    SAFE_BLOCK_CATEGORY_KEYS,
    SAFE_BLOCK_CATEGORY_LABELS,
    type SafeBlockCategoryKey,
} from '../lib/blockCategories';
import { FutureSelfContractModal } from '../components/FutureSelfContractModal';
import type { FutureSelfContract } from '../lib/futureSelfTypes';
import { invokeAuthedFunction } from '../lib/supabaseFunctions';

function FocusScoreBarGraph({ points }: { points: { date: string; score: number }[] }) {
    const [hovered, setHovered] = useState<number | null>(null);
    const [chartMode, setChartMode] = useState<'bar' | 'line'>('line');
    const uid = `focus-score-${points.map((point) => point.date).join('-').replace(/[^a-zA-Z0-9-]/g, '')}`;
    const width = 560;
    const height = 200;
    const padX = 36;
    const padTop = 24;
    const padBottom = 28;
    const chartHeight = height - padTop - padBottom;
    const chartWidth = width - padX * 2;
    const gap = 10;
    const barW = Math.max(24, (chartWidth - gap * (points.length - 1)) / Math.max(1, points.length));
    const maxGraphHeight = 220;

    const getX = (i: number) => padX + i * (barW + gap);
    const getY = (score: number) => padTop + chartHeight - (score / 100) * chartHeight;
    const getH = (score: number) => Math.max(score > 0 ? 4 : 0, (score / 100) * chartHeight);
    const getPointX = (i: number) => padX + (i * chartWidth / Math.max(1, points.length - 1));
    const linePath = points.reduce((path, point, i) => {
        const x = getPointX(i);
        const y = getY(point.score);
        if (i === 0) return `M ${x} ${y}`;
        const previousX = getPointX(i - 1);
        const previousY = getY(points[i - 1].score);
        const controlX = (previousX + x) / 2;
        return `${path} C ${controlX} ${previousY}, ${controlX} ${y}, ${x} ${y}`;
    }, '');

    return (
        <div className="relative w-full flex justify-center">
            <div
                className="relative w-full"
                style={{ maxWidth: (maxGraphHeight * width) / height, aspectRatio: `${width} / ${height}`, maxHeight: maxGraphHeight }}
            >
                <div
                    className="absolute right-1 top-0 z-20 flex rounded-lg border border-white/8 bg-black/50 p-0.5 shadow-sm backdrop-blur"
                    role="group"
                    aria-label="Focus score chart type"
                >
                    {(['bar', 'line'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setChartMode(mode)}
                            aria-pressed={chartMode === mode}
                            className={`rounded-lg px-2 py-1 text-[11px] font-[460] capitalize transition-colors ${
                                chartMode === mode ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="block h-full w-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <linearGradient id={`${uid}-area`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#d4d4d4" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {[0, 25, 50, 75, 100].map((v) => (
                        <g key={v}>
                            <line x1={padX} y1={getY(v)} x2={width - padX} y2={getY(v)} stroke="white" strokeOpacity="0.05" />
                            <text x={4} y={getY(v) + 4} className="text-[11px] fill-neutral-600 font-medium">{v}</text>
                        </g>
                    ))}
                    {chartMode === 'line' && points.length > 0 && (
                        <>
                            <motion.path
                                key={`area-${linePath}`}
                                d={`${linePath} L ${getPointX(points.length - 1)} ${padTop + chartHeight} L ${getPointX(0)} ${padTop + chartHeight} Z`}
                                fill={`url(#${uid}-area)`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.45 }}
                            />
                            <motion.path
                                key={linePath}
                                d={linePath}
                                fill="none"
                                stroke="#d4d4d4"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                            />
                        </>
                    )}
                    {points.map((p, i) => {
                        const x = getX(i);
                        const y = getY(p.score);
                        const h = getH(p.score);
                        const active = hovered === i;
                        const pointX = getPointX(i);
                        return (
                            <g
                                key={p.date}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                onFocus={() => setHovered(i)}
                                onBlur={() => setHovered(null)}
                                className="cursor-pointer"
                                tabIndex={0}
                                role="img"
                                aria-label={`${new Date(p.date).toLocaleDateString('en-US', { weekday: 'long' })}: focus score ${p.score}`}
                            >
                                <rect
                                    x={chartMode === 'bar' ? x : pointX - Math.max(20, chartWidth / points.length / 2)}
                                    y={padTop}
                                    width={chartMode === 'bar' ? barW : Math.max(40, chartWidth / points.length)}
                                    height={chartHeight}
                                    fill="transparent"
                                />
                                {chartMode === 'bar' ? (
                                    <motion.rect
                                        x={x}
                                        width={barW}
                                        rx={6}
                                        fill={focusScoreColor(p.score)}
                                        opacity={active ? 1 : 0.8}
                                        initial={{ y: padTop + chartHeight, height: 0 }}
                                        animate={{ y, height: h }}
                                        transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeOut' }}
                                    />
                                ) : (
                                    <circle
                                        cx={pointX}
                                        cy={y}
                                        r={active ? 5.5 : 3.5}
                                        fill="#0a0a0a"
                                        stroke={active ? '#fff' : 'var(--fz-text-4)'}
                                        strokeWidth="2"
                                        vectorEffect="non-scaling-stroke"
                                        className="transition-all duration-150"
                                    />
                                )}
                                {p.score > 0 && (
                                    <text
                                        x={chartMode === 'bar' ? x + barW / 2 : pointX}
                                        y={Math.max(14, y - 6)}
                                        textAnchor="middle"
                                        className="fill-neutral-300 font-semibold"
                                        style={{ fontSize: 11, opacity: chartMode === 'bar' || active ? 1 : 0 }}
                                    >
                                        {p.score}
                                    </text>
                                )}
                                <text x={chartMode === 'bar' ? x + barW / 2 : pointX} y={height - 8} textAnchor="middle" className="text-[11px] fill-neutral-600 font-medium">
                                    {new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

export const PatternsTab = () => {
    const { last7DaysStats, engineState, streak, dashboardStreak } = useAuthStore();
    const allStats = last7DaysStats ?? [];
    const patterns = detectProcrastinationPatterns(allStats, engineState.dailyPlanner ?? []);
    const [overrideLog, setOverrideLog] = useState<EmergencyOverrideEntry[]>([]);

    useEffect(() => {
        chrome.runtime.sendMessage({ type: 'GET_OVERRIDE_LOG' }, (resp) => {
            if (resp?.ok && Array.isArray(resp.log)) setOverrideLog(resp.log);
        });
    }, []);

    const overridePatterns = detectOverridePatterns(overrideLog);

    const todayIdx = allStats.length - 1;
    const todayData = todayIdx >= 0 ? allStats[todayIdx] : undefined;
    const focusResult = computeFocusScore({
        todaySites: todayData?.sites,
        todayTotalMs: todayData?.total,
        blockedToday: engineState.blockedToday,
        dailyPlanner: engineState.dailyPlanner,
        habits: engineState.habits,
        streak: dashboardStreak,
    });

    const recentWeek = allStats.slice(-7);
    const weekScores = recentWeek.map((d) => ({
        date: d.date,
        score: computeFocusScore({ todaySites: d.sites, todayTotalMs: d.total }).score,
    }));
    const allTime = computeAllTimeFocusScore(allStats);

    const severityStyle = {
        high: 'border-red-500/30 bg-red-500/10',
        medium: 'border-[var(--fz-warning)]/30 bg-[var(--fz-warning-soft)]',
        low: 'border-[var(--fz-accent)] bg-[var(--fz-accent-soft)]',
    };

    const formatTime = (ms: number) => {
        const mins = Math.round(capDayScreenMs(ms) / 60000);
        if (mins < 60) return `${mins}m`;
        return `${(mins / 60).toFixed(1)}h`;
    };

    return (
        <div className="space-y-6 animate-fade-in-up">

            {/* Activity heatmap */}
            <GlassCard className="p-5">
                <h3 className="font-semibold text-white text-sm mb-1">Focus activity</h3>
                <p className="text-[11px] font-[460] text-neutral-500 mb-4">Last 12 weeks · brighter = higher focuz score</p>
                <FocusActivityChart stats={allStats} weeks={12} />
            </GlassCard>

            {/* Weekly stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <GlassCard className="p-5">
                    <span className="text-[11px] font-[460] text-neutral-500">Today&apos;s score</span>
                    <p className="text-2xl font-semibold tabular-nums mt-1" style={{ color: focusScoreColor(focusResult.score) }}>{focusResult.score}</p>
                    <p className="text-xs text-neutral-500">{focusResult.label}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[11px] font-[460] text-neutral-500">All-time score</span>
                    <p className="text-2xl font-semibold tabular-nums mt-1" style={{ color: focusScoreColor(allTime.score) }}>{allTime.score}</p>
                    <p className="text-xs text-neutral-500">{allTime.daysCounted > 0 ? `Avg · ${pluralize(allTime.daysCounted, 'day')}` : 'No data yet'}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[11px] font-[460] text-neutral-500">Usage today</span>
                    <p className="text-2xl font-semibold tabular-nums text-white mt-1">{formatTime(todayData?.total ?? 0)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[11px] font-[460] text-neutral-500">Blocks today</span>
                    <p className="text-2xl font-semibold tabular-nums text-white mt-1">{engineState.blockedToday ?? 0}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[11px] font-[460] text-neutral-500">Activity streak</span>
                    <p className="text-2xl font-semibold tabular-nums text-[var(--fz-accent)] mt-1">{streak}<span className="text-sm text-neutral-500 ml-1">d</span></p>
                </GlassCard>
            </div>

            {/* Weekly focus score graph */}
            <GlassCard className="p-5">
                <h3 className="font-semibold text-white text-sm mb-1">Weekly focuz scores</h3>
                <p className="text-[11px] font-[460] text-neutral-500 mb-4">Last 7 days · 0–100</p>
                {weekScores.length === 0 ? (
                    <p className="text-sm text-neutral-600 py-10 text-center">Not enough data yet — scores appear after a day of use.</p>
                ) : (
                    <FocusScoreBarGraph points={weekScores} />
                )}
            </GlassCard>

            {/* AI Patterns section */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-2">AI patterns</h3>
                <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                    Procrastination and distraction patterns detected from your local browsing data.
                </p>
                {patterns.length === 0 ? (
                    <GlassCard className="p-10">
                        <div className="flex flex-col items-center justify-center text-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-[var(--fz-accent-soft)] flex items-center justify-center">
                                <Lightbulb size={22} className="text-[var(--fz-accent)]" />
                            </div>
                            <p className="text-white font-semibold">No patterns detected yet</p>
                            <p className="text-neutral-500 text-sm leading-relaxed max-w-xs">
                                Keep using FocuzNow for a few days — distraction and procrastination
                                insights will appear here automatically.
                            </p>
                        </div>
                    </GlassCard>
                ) : (
                    <div className="space-y-4">
                        {patterns.map((p) => (
                            <GlassCard key={p.id} className={`p-5 border ${severityStyle[p.severity]}`}>
                                <div className="flex items-start gap-3">
                                    {p.severity === 'high' ? (
                                        <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                                    ) : (
                                        <TrendingDown size={18} className="text-[var(--fz-warning)] shrink-0 mt-0.5" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <h4 className="font-semibold text-white">{p.title}</h4>
                                            <span className="text-[11px] font-[460] px-2 py-0.5 rounded bg-white/6 text-neutral-400">
                                                {p.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-400 mb-3 leading-relaxed">{p.detail}</p>
                                        <p className="text-sm text-[var(--fz-accent)] leading-relaxed">
                                            <span className="font-[460] text-[var(--fz-accent)] block mb-1">Try this</span>
                                            {p.suggestion}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </div>

            {overridePatterns.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Emergency override patterns</h3>
                    <p className="text-sm text-neutral-500 mb-4">
                        Based on your emergency unlock history — all stored locally.
                    </p>
                    <div className="space-y-3">
                        {overridePatterns.map((p) => (
                            <GlassCard key={p.id} className={`p-5 border ${severityStyle[p.severity]}`}>
                                <h4 className="font-semibold text-white mb-1">{p.title}</h4>
                                <p className="text-sm text-neutral-400 leading-relaxed">{p.description}</p>
                            </GlassCard>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

type Habit = { id: number; name: string; streak: number; checkins: string[]; lastCheckin?: string };

/** Habit ids are creation timestamps (kept for existing data). */
const newHabitId = () => Date.now();

const HABIT_SUGGESTIONS = ['Meditate', 'Read 20 pages', 'Deep work block', 'Exercise', 'No phone first hour'];
const HEAT_DAYS = 14;

/** Consecutive days checked, ending today (or yesterday, if today isn't done yet). */
function currentStreak(checkins: string[] = []): number {
    const done = new Set(checkins);
    const d = new Date();
    if (!done.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let n = 0;
    while (done.has(d.toDateString())) {
        n += 1;
        d.setDate(d.getDate() - 1);
    }
    return n;
}

function lastDays(count: number): Date[] {
    return Array.from({ length: count }, (_, i) => {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - (count - 1 - i));
        return d;
    });
}

function HabitHeatStrip({ checkins }: { checkins: string[] }) {
    const done = new Set(checkins);
    const days = lastDays(HEAT_DAYS);
    const todayStr = new Date().toDateString();
    return (
        <div className="hidden items-center gap-[5px] md:flex" aria-label={`Last ${HEAT_DAYS} days`}>
            {days.map((d) => {
                const key = d.toDateString();
                const on = done.has(key);
                return (
                    <span
                        key={key}
                        title={`${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${on ? ' · done' : ''}`}
                        className={`size-3 rounded-[3px] ${
                            on ? 'bg-[var(--fz-text-1)]' : 'bg-[var(--fz-bg-active)]'
                        } ${key === todayStr ? 'ring-1 ring-[var(--fz-border-strong)] ring-offset-1 ring-offset-[var(--fz-bg-raised)]' : ''}`}
                    />
                );
            })}
        </div>
    );
}

export const HabitsTab = () => {
    const { engineState } = useAuthStore();
    const habits: Habit[] = engineState.habits || [];
    const todayStr = new Date().toDateString();
    const [nameModal, setNameModal] = useState<{ habit?: Habit } | null>(null);
    const [removing, setRemoving] = useState<Habit | null>(null);
    const [error, setError] = useState('');

    /** Save instantly on screen; roll back if the save is refused. */
    const saveHabits = async (updated: Habit[]) => {
        const before = useAuthStore.getState().engineState;
        useAuthStore.setState({ engineState: { ...before, habits: updated } });
        const resp = await new Promise<{ ok?: boolean; error?: string; state?: EngineState }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } },
                (r) => resolve(r || { ok: false, error: chrome.runtime.lastError?.message }),
            ),
        );
        if (resp.ok === false) {
            useAuthStore.setState({ engineState: before });
            setError(resp.error || 'Could not save your habits.');
            return false;
        }
        setError('');
        if (resp.state && typeof resp.state === 'object') {
            useAuthStore.setState({ engineState: { ...useAuthStore.getState().engineState, ...resp.state } });
        }
        return true;
    };

    const addHabit = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        await saveHabits([...habits, { id: newHabitId(), name: trimmed, streak: 0, checkins: [], lastCheckin: '' }]);
    };

    const renameHabit = async (id: number, name: string) => {
        await saveHabits(habits.map((h) => (h.id === id ? { ...h, name: name.trim() } : h)));
    };

    const checkIn = async (id: number) => {
        const updated = habits.map((h) => {
            if (h.id !== id || h.checkins?.includes(todayStr)) return h;
            const checkins = [...(h.checkins || []), todayStr];
            return { ...h, checkins, streak: currentStreak(checkins), lastCheckin: todayStr };
        });
        if (!(await saveHabits(updated))) return;
        await sendProgressionMessage({ type: 'PROGRESSION_HABIT_CHECKIN', habitId: id });
        void useAuthStore.getState().recalculateStreak();
    };

    const undoToday = async (id: number) => {
        await saveHabits(
            habits.map((h) => {
                if (h.id !== id) return h;
                const checkins = (h.checkins || []).filter((d) => d !== todayStr);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                return {
                    ...h,
                    checkins,
                    streak: currentStreak(checkins),
                    lastCheckin: checkins.includes(yesterday.toDateString()) ? yesterday.toDateString() : '',
                };
            }),
        );
        void useAuthStore.getState().recalculateStreak();
    };

    const doneToday = habits.filter((h) => h.checkins?.includes(todayStr)).length;
    const bestStreak = habits.reduce((m, h) => Math.max(m, currentStreak(h.checkins)), 0);
    const week = lastDays(7).map((d) => d.toDateString());
    const weekDone = habits.reduce((n, h) => n + week.filter((d) => h.checkins?.includes(d)).length, 0);
    const weekPct = habits.length ? Math.round((weekDone / (habits.length * 7)) * 100) : 0;
    const todayPct = habits.length ? (doneToday / habits.length) * 100 : 0;

    return (
        <div className="space-y-4 animate-fade-in-up">
            {error && (
                <Banner tone="danger" onDismiss={() => setError('')}>
                    {error}
                </Banner>
            )}

            {habits.length === 0 ? (
                <GlassCard>
                    <EmptyState
                        className="py-16"
                        icon={<Repeat size={15} />}
                        title="Start your first habit"
                        description="Pick something small you can do every day. Check it off here or from your Dashboard — a day in a row grows your streak."
                        action={
                            <div className="mt-2 flex max-w-[460px] flex-col items-center gap-4">
                                <div className="flex flex-wrap justify-center gap-2">
                                    {HABIT_SUGGESTIONS.map((s) => (
                                        <Chip key={s} icon={<Plus size={12} />} onClick={() => void addHabit(s)}>
                                            {s}
                                        </Chip>
                                    ))}
                                </div>
                                <Button variant="primary" iconLeft={<Plus size={14} />} onClick={() => setNameModal({})}>
                                    New habit
                                </Button>
                            </div>
                        }
                    />
                </GlassCard>
            ) : (
                <>
                    {/* Today at a glance */}
                    <GlassCard className="p-5">
                        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                            <div>
                                <p className="text-meta">
                                    Today · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                </p>
                                <p className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em] tabular-nums text-[var(--fz-text-1)]">
                                    {doneToday} of {habits.length}
                                    <span className="ml-2 text-[15px] font-medium tracking-normal text-[var(--fz-text-3)]">
                                        {doneToday === habits.length ? 'all done' : 'done'}
                                    </span>
                                </p>
                            </div>
                            <div className="flex items-end gap-8">
                                <div>
                                    <p className="text-meta">Best streak</p>
                                    <p className="mt-1 text-[17px] font-semibold tabular-nums text-[var(--fz-text-1)]">
                                        {bestStreak} {bestStreak === 1 ? 'day' : 'days'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-meta">Last 7 days</p>
                                    <p className="mt-1 text-[17px] font-semibold tabular-nums text-[var(--fz-text-1)]">{weekPct}%</p>
                                </div>
                                <Button variant="primary" iconLeft={<Plus size={14} />} onClick={() => setNameModal({})}>
                                    New habit
                                </Button>
                            </div>
                        </div>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                            <div
                                className="h-full rounded-full bg-[var(--fz-text-1)] transition-[width] duration-500 ease-out"
                                style={{ width: `${todayPct}%` }}
                            />
                        </div>
                    </GlassCard>

                    {/* The list */}
                    <GlassCard>
                        <div className="flex items-center justify-between px-5 pb-3 pt-4">
                            <h3 className="text-[14px] font-semibold text-[var(--fz-text-1)]">Your habits</h3>
                            <span className="text-meta hidden md:block">Last {HEAT_DAYS} days</span>
                        </div>
                        <div className="divide-y divide-[var(--fz-border)] border-t border-[var(--fz-border)]">
                            {habits.map((h) => {
                                const checkedToday = !!h.checkins?.includes(todayStr);
                                const streak = currentStreak(h.checkins);
                                return (
                                    <div key={h.id} className="flex items-center gap-4 px-5 py-3">
                                        <HabitCheckInButton size="md" checked={checkedToday} onCheckIn={() => checkIn(h.id)} />
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={`truncate text-[14px] font-medium ${
                                                    checkedToday ? 'text-[var(--fz-text-2)]' : 'text-[var(--fz-text-1)]'
                                                }`}
                                            >
                                                {h.name}
                                            </p>
                                            <p className="text-meta mt-0.5 flex items-center gap-1.5">
                                                <Flame
                                                    size={12}
                                                    className={streak > 0 ? 'text-[var(--fz-text-2)]' : 'text-[var(--fz-text-4)]'}
                                                />
                                                {streak > 0 ? `${streak}-day streak` : 'No streak yet'}
                                                <span className="text-[var(--fz-text-4)]">·</span>
                                                {checkedToday ? 'Done today' : 'Not yet today'}
                                            </p>
                                        </div>
                                        <HabitHeatStrip checkins={h.checkins || []} />
                                        <BulkMenu
                                            label={`Options for ${h.name}`}
                                            items={[
                                                { id: 'rename', label: 'Rename', icon: <Pencil size={13} />, onSelect: () => setNameModal({ habit: h }) },
                                                ...(checkedToday
                                                    ? [{ id: 'undo', label: 'Undo today’s check-in', icon: <RotateCcw size={13} />, onSelect: () => void undoToday(h.id) }]
                                                    : []),
                                                { id: 'delete', label: 'Delete', icon: <Trash size={13} />, danger: true, onSelect: () => setRemoving(h) },
                                            ]}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                </>
            )}

            <HabitNameModal
                open={!!nameModal}
                initialName={nameModal?.habit?.name}
                title={nameModal?.habit ? 'Rename habit' : 'New habit'}
                submitLabel={nameModal?.habit ? 'Save' : 'Add habit'}
                onClose={() => setNameModal(null)}
                onSubmit={(name) => (nameModal?.habit ? renameHabit(nameModal.habit.id, name) : addHabit(name))}
            />
            <Dialog
                open={!!removing}
                onClose={() => setRemoving(null)}
                size="sm"
                title={removing ? `Delete “${removing.name}”?` : 'Delete habit?'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setRemoving(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger-solid"
                            onClick={() => {
                                const target = removing;
                                setRemoving(null);
                                if (target) void saveHabits(habits.filter((x) => x.id !== target.id));
                            }}
                        >
                            Delete habit
                        </Button>
                    </>
                }
            >
                <p className="text-body-sm text-[var(--fz-text-3)]">
                    Its streak and check-in history will be gone. This can’t be undone.
                </p>
            </Dialog>
        </div>
    );
};

export const SessionsTab = () => {
    const { engineState, fetchEngineState, dashboardStreak, subscriptionTier } = useAuthStore();
    const defaultPomo = engineState.pomodoroSettings || { focusMin: 25, breakMin: 5, sessionsCompleted: 0, lastDate: '' };
    const [pomoTiming, setPomoTiming] = useState({
        focusMin: defaultPomo.focusMin,
        breakMin: defaultPomo.breakMin,
    });
    const [pomoRunning, setPomoRunning] = useState(false);
    const [pomoTimeLeft, setPomoTimeLeft] = useState(pomoTiming.focusMin * 60);
    const [isBreak, setIsBreak] = useState(false);
    const [pomoEndAt, setPomoEndAt] = useState<number | null>(null);
    const timerRef = useRef<number | null>(null);
    const runtimeRevisionRef = useRef(0);
    const pomoTimingRef = useRef(pomoTiming);
    const [pomoNotice, setPomoNotice] = useState('');
    const [runtime, setRuntime] = useState<PomodoroRuntime | null>(null);
    const [futureSelfEnabled, setFutureSelfEnabled] = useState(false);
    const [futureSelfModalOpen, setFutureSelfModalOpen] = useState(false);
    /** "Custom" chosen explicitly (keeps it selected even when the minutes happen to match a preset). */
    const [customPicked, setCustomPicked] = useState(false);

    useEffect(() => {
        void chrome.runtime
            .sendMessage({ type: 'FUTURE_SELF_GET', dashboardOpen: false })
            .then((response: { state?: { modeEnabled?: boolean } } | undefined) => {
                if (typeof response?.state?.modeEnabled === 'boolean') {
                    setFutureSelfEnabled(response.state.modeEnabled);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const revision = runtimeRevisionRef.current;
        const timing = {
            focusMin: defaultPomo.focusMin,
            breakMin: defaultPomo.breakMin,
        };
        const timeoutId = window.setTimeout(() => {
            if (runtimeRevisionRef.current !== revision) return;
            pomoTimingRef.current = timing;
            setPomoTiming(timing);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [defaultPomo.focusMin, defaultPomo.breakMin]);

    const buildRuntime = (
        partial: Partial<PomodoroRuntime> & { running: boolean; paused: boolean },
    ): PomodoroRuntime => ({
        running: partial.running,
        paused: partial.paused,
        endAt: partial.endAt ?? null,
        timeLeftSec: partial.timeLeftSec ?? Math.round(pomoTiming.focusMin * 60),
        isBreak: partial.isBreak ?? isBreak,
        segmentTotalSec:
            partial.segmentTotalSec ??
            Math.round(((partial.isBreak ?? isBreak) ? pomoTiming.breakMin : pomoTiming.focusMin) * 60),
        focusMin: pomoTiming.focusMin,
        breakMin: pomoTiming.breakMin,
        segmentId: partial.segmentId ?? runtime?.segmentId,
        futureSelfContractId: partial.futureSelfContractId ?? runtime?.futureSelfContractId,
    });

    const applyRuntimeToUi = useCallback((rt: PomodoroRuntime | null) => {
        setRuntime(rt);
        if (!rt) {
            setPomoRunning(false);
            setPomoEndAt(null);
            setIsBreak(false);
            setPomoTimeLeft(pomoTimingRef.current.focusMin * 60);
            return;
        }
        setIsBreak(rt.isBreak);
        setPomoRunning(rt.running && !rt.paused);
        setPomoEndAt(rt.running && !rt.paused ? rt.endAt : null);
        setPomoTimeLeft(computeTimeLeft(rt));
    }, []);

    const persistRuntime = async (rt: PomodoroRuntime | null) => {
        runtimeRevisionRef.current += 1;
        await writePomodoroRuntime(rt);
        applyRuntimeToUi(rt);
    };

    useEffect(() => {
        const hydrationRevision = runtimeRevisionRef.current;
        void readPomodoroRuntime().then((rt) => {
            if (runtimeRevisionRef.current === hydrationRevision) applyRuntimeToUi(rt);
        });
        const onStorage = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ) => {
            if (area !== 'local' || !changes[POMODORO_RUNTIME_KEY]) return;
            applyRuntimeToUi(
                (changes[POMODORO_RUNTIME_KEY].newValue as PomodoroRuntime | undefined) ?? null,
            );
        };
        chrome.storage.onChanged.addListener(onStorage);
        return () => chrome.storage.onChanged.removeListener(onStorage);
    }, [applyRuntimeToUi]);

    useEffect(() => {
        const onMsg = (msg: { type?: string }) => {
            if (msg.type === 'POMODORO_SEGMENT_DONE' || msg.type === 'POMODORO_AFK_PAUSED') {
                void readPomodoroRuntime().then((rt) => {
                    applyRuntimeToUi(rt);
                    fetchEngineState();
                    if (msg.type === 'POMODORO_AFK_PAUSED') {
                        setPomoNotice('Paused — no movement detected for 5 minutes');
                        window.setTimeout(() => setPomoNotice(''), 5000);
                        return;
                    }
                    if (rt?.isBreak && rt.running) {
                        dispatchFocusComplete();
                        setPomoNotice('Focus complete — break started');
                    } else if (rt && !rt.isBreak && !rt.running) {
                        setPomoNotice('Break over — ready to focus');
                    }
                    window.setTimeout(() => setPomoNotice(''), 5000);
                });
            }
        };
        chrome.runtime.onMessage.addListener(onMsg);
        return () => chrome.runtime.onMessage.removeListener(onMsg);
    }, [applyRuntimeToUi, fetchEngineState]);

    useEffect(() => {
        if (!pomoRunning || !pomoEndAt) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        let completing = false;
        timerRef.current = window.setInterval(() => {
            const left = Math.max(0, Math.ceil((pomoEndAt - Date.now()) / 1000));
            setPomoTimeLeft(left);
            if (left <= 0 && !completing) {
                completing = true;
                void (async () => {
                    let next: PomodoroRuntime | null = null;
                    try {
                        const res = (await chrome.runtime.sendMessage({
                            type: 'POMODORO_SEGMENT_COMPLETE',
                        })) as { ok?: boolean } | undefined;
                        next = await readPomodoroRuntime();
                        // Extension options: background advanced storage.
                        // Web app: message is a no-op — force local transition if still stuck.
                        if (!res?.ok || (next?.running && computeTimeLeft(next) <= 0)) {
                            next = await completePomodoroSegmentLocal(next);
                        }
                    } catch {
                        next = await completePomodoroSegmentLocal();
                    }
                    applyRuntimeToUi(next);
                    if (next?.isBreak && next.running) {
                        dispatchFocusComplete();
                        setPomoNotice('Focus complete — break started');
                        window.setTimeout(() => setPomoNotice(''), 5000);
                    } else if (next && !next.isBreak && !next.running) {
                        setPomoNotice('Break over — ready to focus');
                        window.setTimeout(() => setPomoNotice(''), 5000);
                    }
                    fetchEngineState();
                })();
            }
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [pomoRunning, pomoEndAt, applyRuntimeToUi, fetchEngineState]);

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    const updatePomodoroSettings = async (focusMin: number, breakMin: number) => {
        const updated = { ...defaultPomo, focusMin, breakMin };
        const timing = { focusMin, breakMin };
        pomoTimingRef.current = timing;
        setPomoTiming(timing);
        const updateSettings = new Promise<void>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { pomodoroSettings: updated } },
                () => resolve(),
            ),
        );
        if (pomoRunning) {
            await updateSettings;
            await fetchEngineState();
            return;
        }

        const resetRuntime = createResetPomodoroRuntime(focusMin, breakMin, isBreak);
        runtimeRevisionRef.current += 1;
        applyRuntimeToUi(resetRuntime);
        await Promise.all([
            updateSettings,
            writePomodoroRuntime(resetRuntime),
        ]);
        await fetchEngineState();
    };
    const sessionPresets = [
        { label: 'Quick', focus: 15, rest: 3 },
        { label: 'Classic', focus: 25, rest: 5 },
        { label: 'Deep', focus: 50, rest: 10 },
    ];
    const matchingPreset = sessionPresets.find((p) => pomoTiming.focusMin === p.focus && pomoTiming.breakMin === p.rest)?.label;
    const presetValue = customPicked || !matchingPreset ? 'Custom' : matchingPreset;
    const completedToday = defaultPomo.sessionsCompleted ?? 0;
    const segmentSeconds = Math.max(
        1,
        runtime?.segmentTotalSec
            ?? Math.round((isBreak ? pomoTiming.breakMin : pomoTiming.focusMin) * 60),
    );
    const beginFocus = async (contract?: FutureSelfContract) => {
        const segmentId = runtime?.segmentId ?? globalThis.crypto?.randomUUID?.() ?? `segment-${Date.now()}`;
        const endAt = Date.now() + pomoTimeLeft * 1000;
        await persistRuntime(
            buildRuntime({
                running: true,
                paused: false,
                endAt,
                timeLeftSec: pomoTimeLeft,
                isBreak,
                segmentTotalSec: runtime?.paused ? runtime.segmentTotalSec : pomoTimeLeft,
                segmentId,
                futureSelfContractId: contract?.id ?? runtime?.futureSelfContractId,
            }),
        );
        setFutureSelfModalOpen(false);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {pomoNotice && (
                <div role="status" className="mx-auto max-w-xl rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-medium text-emerald-400">
                    {pomoNotice}
                </div>
            )}
            
            <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <GlassCard className="flex min-h-[500px] w-full flex-col items-center justify-center p-7 sm:p-9">
                    <div className="mb-5 flex w-full justify-center">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-[460] ${
                            isBreak ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--fz-accent-soft)] text-[var(--fz-accent)]'
                        }`}>
                            {isBreak ? 'Recovery break' : pomoRunning ? 'Focus in progress' : 'Ready to focus'}
                        </span>
                    </div>

                    <div className="flex w-full items-center justify-center">
                        <div className="relative h-64 w-64 shrink-0 sm:h-72 sm:w-72">
                            <svg
                                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                                viewBox="0 0 200 200"
                                aria-hidden
                            >
                                <circle cx="100" cy="100" r="82" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="4" />
                                <circle
                                    cx="100"
                                    cy="100"
                                    r="82"
                                    fill="none"
                                    stroke={isBreak ? '#22c55e' : 'var(--fz-accent)'}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 82}`}
                                    strokeDashoffset={`${2 * Math.PI * 82 * (1 - Math.min(1, pomoTimeLeft / segmentSeconds))}`}
                                    className="transition-all duration-1000"
                                />
                            </svg>
                            <div className="pointer-events-none absolute inset-[18%] flex flex-col items-center justify-center text-center">
                                <span className="text-[64px] leading-none tracking-[-0.04em] text-[var(--dashboard-text)] tabular-nums" style={{ fontWeight: 560 }}>
                                    {formatTime(pomoTimeLeft)}
                                </span>
                                <span className="mt-3 text-[11px] font-medium  text-[var(--dashboard-text-muted)]">
                                    {pomoTiming.focusMin} min focus · {pomoTiming.breakMin} min rest
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-7 flex w-full justify-center gap-2">
                        <button onClick={() => {
                            void (async () => {
                                if (pomoRunning) {
                                    const left = pomoEndAt
                                        ? Math.max(0, Math.ceil((pomoEndAt - Date.now()) / 1000))
                                        : pomoTimeLeft;
                                    await persistRuntime(
                                        buildRuntime({
                                            running: false,
                                            paused: true,
                                            endAt: null,
                                            timeLeftSec: left,
                                            isBreak,
                                            segmentTotalSec: runtime?.segmentTotalSec ?? segmentSeconds,
                                        }),
                                    );
                                } else if (runtime?.paused || isBreak) {
                                    await beginFocus();
                                } else if (futureSelfEnabled) {
                                    setFutureSelfModalOpen(true);
                                } else {
                                    await beginFocus();
                                }
                            })();
                        }}
                            className={`flex min-w-32 items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${pomoRunning ? 'border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] text-[var(--dashboard-text)] hover:bg-[var(--dashboard-interactive-hover)]' : 'bg-[var(--dashboard-text)] text-[var(--dashboard-bg)] opacity-95 hover:opacity-100'}`}>
                            {pomoRunning ? <><Pause size={16} /><span>Pause</span></> : <><Play size={16} /><span>Start focus</span></>}
                        </button>
                        <button onClick={() => {
                            if (runtime?.futureSelfContractId) {
                                void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_FINISH', status: 'cancelled' });
                            }
                            void persistRuntime(null);
                        }}
                            aria-label="Reset session"
                            title="Reset session"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-interactive-hover)] hover:text-[var(--dashboard-text)]">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </GlassCard>
                <div className="flex flex-col gap-4">
                    <GlassCard className="p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-medium text-[var(--dashboard-text)]">Future Self Mode</h2>
                                    <span className="rounded bg-[var(--fz-accent-soft)] px-1.5 py-0.5 text-[11px] font-[460] text-[var(--fz-accent)]">Pro</span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--dashboard-text-muted)]">Make this Pomodoro a deliberate promise.</p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={futureSelfEnabled}
                                disabled={pomoRunning}
                                onClick={() => {
                                    if (subscriptionTier !== 'pro') {
                                        setFutureSelfModalOpen(true);
                                        return;
                                    }
                                    setFutureSelfEnabled((enabled) => {
                                        const next = !enabled;
                                        void chrome.runtime
                                            .sendMessage({ type: 'FUTURE_SELF_SET_MODE', enabled: next })
                                            .catch(() => {});
                                        return next;
                                    });
                                }}
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${futureSelfEnabled ? 'bg-[var(--fz-accent)]' : 'bg-white/10'}`}
                            >
                                <span
                                    className={`pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                        futureSelfEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                    </GlassCard>
                    <GlassCard className="p-4">
                        <h2 className="text-sm font-medium text-[var(--dashboard-text)]">Session presets</h2>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Set your focus cadence.</p>
                        <div className="mt-3">
                            <SegmentedControl
                                className="w-full"
                                idPrefix="pomo-preset"
                                value={presetValue}
                                onChange={(v) => {
                                    const preset = sessionPresets.find((p) => p.label === v);
                                    setCustomPicked(!preset);
                                    if (preset) void updatePomodoroSettings(preset.focus, preset.rest);
                                }}
                                options={[
                                    ...sessionPresets.map((p) => ({ value: p.label, label: p.label })),
                                    { value: 'Custom' as const, label: 'Custom' },
                                ]}
                            />
                            {presetValue === 'Custom' ? (
                                <CustomPomodoroTiming
                                    key={`${pomoTiming.focusMin}-${pomoTiming.breakMin}`}
                                    focusMin={pomoTiming.focusMin}
                                    breakMin={pomoTiming.breakMin}
                                    onCommit={(f, b) => void updatePomodoroSettings(f, b)}
                                />
                            ) : null}
                            <p className="mt-2 text-[11px] text-[var(--dashboard-text-muted)]">
                                {pomoTiming.focusMin} min focus · {pomoTiming.breakMin} min break
                                {pomoRunning ? ' · applies to the next session' : ''}
                            </p>
                        </div>
                    </GlassCard>
                    <GlassCard className="p-4">
                        <div className="flex items-end justify-between border-b border-[var(--dashboard-border)] pb-3">
                            <div>
                                <p className="text-[11px] font-medium  text-[var(--dashboard-text-muted)]">Today</p>
                                <p className="mt-1 text-2xl font-semibold text-[var(--dashboard-text)] tabular-nums">{completedToday}</p>
                            </div>
                            <p className="pb-1 text-xs text-[var(--dashboard-text-muted)]">completed sessions</p>
                        </div>
                        <div className="flex items-center justify-between pt-3">
                            <span className="text-xs text-[var(--dashboard-text-muted)]">Current streak</span>
                            <span className="text-xs font-medium text-[var(--dashboard-text)]">{dashboardStreak} {dashboardStreak === 1 ? 'day' : 'days'}</span>
                        </div>
                    </GlassCard>
                </div>
            </div>
            <FutureSelfContractModal
                open={futureSelfModalOpen}
                isPro={subscriptionTier === 'pro'}
                focusMinutes={pomoTiming.focusMin}
                onClose={() => setFutureSelfModalOpen(false)}
                onUpgrade={() => window.dispatchEvent(new CustomEvent('focuznow-navigate-tab', { detail: 'account' }))}
                onStarted={(contract) => void beginFocus(contract)}
            />
        </div>
    );
};

/** Focus / break minutes for the Custom preset; saved on Enter or when a field loses focus. */
function CustomPomodoroTiming({
    focusMin,
    breakMin,
    onCommit,
}: {
    focusMin: number;
    breakMin: number;
    onCommit: (focusMin: number, breakMin: number) => void;
}) {
    const [focus, setFocus] = useState(String(focusMin));
    const [rest, setRest] = useState(String(breakMin));
    const clamp = (raw: string, min: number, max: number, fallback: number) => {
        const n = Math.round(parseFloat(raw) * 2) / 2;
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const commit = () => {
        const f = clamp(focus, 1, 180, focusMin);
        const b = clamp(rest, 1, 60, breakMin);
        setFocus(String(f));
        setRest(String(b));
        if (f !== focusMin || b !== breakMin) onCommit(f, b);
    };
    const field = (label: string, value: string, set: (v: string) => void, max: number) => (
        <label className="text-[11px] font-medium text-[var(--dashboard-text-muted)]">
            {label}
            <span className="mt-1.5 flex items-center rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] pr-2.5 focus-within:border-[var(--fz-border-strong)]">
                <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={max}
                    step={0.5}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full min-w-0 bg-transparent px-2.5 py-2 text-xs tabular-nums text-[var(--dashboard-text)] outline-none"
                />
                <span className="text-[11px] text-[var(--dashboard-text-muted)]">min</span>
            </span>
        </label>
    );
    return (
        <div className="mt-3 grid grid-cols-2 gap-2">
            {field('Focus', focus, setFocus, 180)}
            {field('Break', rest, setRest, 60)}
        </div>
    );
}

function looksLikeDomainOrUrl(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^https?:\/\//i.test(trimmed)) return true;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?(\/\S*)?$/i.test(trimmed);
}

/** Same shape the block engine stores: lowercase host (no www.) plus any path. */
function normalizeSite(value: string): string {
    let v = value.trim().toLowerCase();
    if (!v) return '';
    try {
        if (v.includes('://')) {
            const u = new URL(v);
            v = u.hostname + (u.pathname && u.pathname !== '/' ? u.pathname : '');
        }
    } catch {
        /* keep the raw text */
    }
    return v.replace(/^www\./, '').replace(/\/+$/, '');
}

async function resolveSiteViaAI(
    query: string,
    accessToken: string,
): Promise<{ domain: string; url: string } | null> {
    try {
        const { data, error } = await invokeAuthedFunction<{ domain?: string; url?: string; error?: string }>(
            'resolve-site-query',
            accessToken,
            { query },
        );
        if (error || !data || data.error || !data.domain) return null;
        return { domain: data.domain, url: data.url || `https://${data.domain}` };
    } catch {
        return null;
    }
}

const noun = (n: number, singular: string, plural = `${singular}s`) => (n === 1 ? singular : plural);

const CATEGORY_ICONS: Record<SafeBlockCategoryKey, LucideIcon> = {
    social: Users,
    gambling: Dices,
    news: Newspaper,
    shopping: ShoppingBag,
    streaming: Tv,
    gaming: Gamepad2,
    dating: Heart,
};

/** Site favicon in a small tile; falls back to the first letter. */
function SiteIcon({ domain, size = 'md' }: { domain: string; size?: 'sm' | 'md' }) {
    const [failed, setFailed] = useState(false);
    const host = domain.replace(/^https?:\/\//, '').split('/')[0];
    return (
        <span
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-hover)] text-[11px] font-semibold uppercase text-[var(--fz-text-3)] ${
                size === 'sm' ? 'size-6' : 'size-7'
            }`}
        >
            {failed ? (
                host.charAt(0)
            ) : (
                <img
                    src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
                    alt=""
                    className={size === 'sm' ? 'size-3.5' : 'size-4'}
                    onError={() => setFailed(true)}
                />
            )}
        </span>
    );
}

/** "…" button with a small menu — keeps bulk actions out of the way. */
function BulkMenu({
    label,
    items,
    disabled,
    pending,
}: {
    label: string;
    items: { id: string; label: string; icon: ReactNode; onSelect: () => void; danger?: boolean }[];
    disabled?: boolean;
    pending?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    return (
        <>
            <IconButton
                ref={anchorRef}
                icon={pending ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={15} />}
                tooltip={label}
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                className="-mr-1.5 -mt-0.5"
            />
            <Menu open={open} onClose={() => setOpen(false)} anchor={anchorRef} align="end" items={items} />
        </>
    );
}

export const BlocklistTab = () => {
    const { engineState, fetchEngineState, session, subscriptionTier } = useAuthStore();
    const isPro = subscriptionTier === 'pro';
    const nuclearActive = !!engineState.nuclearState?.active;

    useEffect(() => {
        if (!engineState.focusMode) {
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { focusMode: true } },
                () => fetchEngineState(),
            );
        }
    }, [engineState.focusMode, fetchEngineState]);

    const [newBlocked, setNewBlocked] = useState('');
    const [newAllowed, setNewAllowed] = useState('');
    const [nuclearDuration, setNuclearDuration] = useState(60);
    const [nukeModalOpen, setNukeModalOpen] = useState(false);
    const [blockActionError, setBlockActionError] = useState('');
    const [categoryPending, setCategoryPending] = useState<SafeBlockCategoryKey | null>(null);
    const [resolvingField, setResolvingField] = useState<'block' | 'allowed_site' | null>(null);
    const [bulkActionPending, setBulkActionPending] = useState<string | null>(null);
    const [platformPending, setPlatformPending] = useState<string | null>(null);
    const [expandedBlockedCategories, setExpandedBlockedCategories] = useState<Partial<Record<SafeBlockCategoryKey, boolean>>>({});
    const [smartYtOpen, setSmartYtOpen] = useState(false);
    // Ticks while a lockdown runs so its countdown stays current.
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        if (!nuclearActive) return;
        const t = window.setInterval(() => setNowMs(Date.now()), 15_000);
        return () => window.clearInterval(t);
    }, [nuclearActive]);
    const patchSmartYouTube = async (next: SmartYouTubeSettings) => {
        await sendEngineMessage({
            type: 'UPDATE_ENGINE_SETTINGS',
            settings: { inAppBlock: { ...engineState.inAppBlock, smartYouTube: next } },
        });
        await fetchEngineState();
    };

    const blocklistCount = Object.keys(engineState.blocklist || {}).filter(
        (d) => engineState.blocklist[d],
    ).length;

    const [challengeState, setChallengeState] = useState<{
        isOpen: boolean;
        domain: string;
        type: string;
        phrase: string;
        source?: string;
        sourceId?: string;
    }>({ isOpen: false, domain: '', type: '', phrase: '' });

    /**
     * Show a change the moment it's made, then settle on what the extension
     * reports. Rolls back (and says why) if the extension refuses or never answers.
     */
    const mutateEngine = async (
        message: Record<string, unknown>,
        optimistic: (s: EngineState) => EngineState,
        failure: string,
    ): Promise<boolean> => {
        const before = useAuthStore.getState().engineState;
        useAuthStore.setState({ engineState: optimistic(before) });
        const response = await new Promise<{ ok?: boolean; error?: string; state?: EngineState }>((resolve) =>
            chrome.runtime.sendMessage(message, (resp) =>
                resolve(resp || { ok: false, error: chrome.runtime.lastError?.message }),
            ),
        );
        if (response.ok === false) {
            useAuthStore.setState({ engineState: before });
            setBlockActionError(response.error || failure);
            return false;
        }
        setBlockActionError('');
        if (response.state && typeof response.state === 'object') {
            useAuthStore.setState({ engineState: { ...useAuthStore.getState().engineState, ...response.state } });
        } else {
            await fetchEngineState();
        }
        return true;
    };

    const executeAction = async (type: string, domain: string, action: 'add' | 'remove') => {
        const site = normalizeSite(domain);
        if (!site) return;
        const ok = await mutateEngine(
            { type: `${action.toUpperCase()}_${type.toUpperCase()}`, domain: site },
            (s) => {
                if (type === 'block') {
                    const blocklist = { ...s.blocklist };
                    if (action === 'add') {
                        const sources = new Set(blocklist[site]?.sources || []);
                        sources.add('manual');
                        blocklist[site] = { ...blocklist[site], sources: [...sources] };
                        return { ...s, blocklist, allowedSites: (s.allowedSites || []).filter((d) => d !== site) };
                    }
                    delete blocklist[site];
                    return { ...s, blocklist };
                }
                const allowed = (s.allowedSites || []).filter((d) => d !== site);
                return { ...s, allowedSites: action === 'add' ? [...allowed, site] : allowed };
            },
            'The blocking change could not be completed.',
        );
        if (ok) setChallengeState((prev) => ({ ...prev, isOpen: false }));
    };

    const executeSourceRemoval = async (domain: string, source: string, sourceId?: string) => {
        const ok = await mutateEngine(
            { type: 'REMOVE_BLOCK_SOURCE', domain, source, sourceId },
            (s) => {
                const blocklist = { ...s.blocklist };
                const entry = blocklist[domain];
                // A timer/schedule can have several instances — only drop the source with the last one.
                const siblings = sourceId && (source === 'timer' || source === 'schedule')
                    ? ((source === 'timer' ? s.timers : s.schedules)?.[domain] || []).filter(
                          (x: { id?: string }) => x.id !== sourceId,
                      ).length
                    : 0;
                if (entry && siblings === 0) {
                    const sources = entry.sources.filter((x) => x !== source);
                    if (sources.length) blocklist[domain] = { ...entry, sources };
                    else delete blocklist[domain];
                }
                return { ...s, blocklist };
            },
            `Could not remove the ${source} block.`,
        );
        if (ok) setChallengeState((prev) => ({ ...prev, isOpen: false }));
    };

    const disableChallenge = async () => {
        const response = await new Promise<{ ok?: boolean; error?: string }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { requireChallenge: false } },
                (resp) => resolve(resp || { ok: false, error: chrome.runtime.lastError?.message }),
            ),
        );
        if (response.ok === false) {
            setBlockActionError(response.error || 'Could not disable the unblock challenge.');
            return;
        }
        setBlockActionError('');
        await fetchEngineState();
        setChallengeState((prev) => ({ ...prev, isOpen: false }));
    };

    const triggerAction = async (type: string, domain: string, action: 'add' | 'remove') => {
        if (!domain.trim()) return;
        if (action === 'remove' && engineState.requireChallenge) {
            setBlockActionError('');
            setChallengeState({
                isOpen: true,
                domain,
                type,
                phrase: randomFocusPhrase(),
            });
            return;
        }
        await executeAction(type, domain, action);
    };

    const triggerSourceRemoval = async (domain: string, source: string, sourceId?: string) => {
        if (engineState.requireChallenge) {
            setBlockActionError('');
            setChallengeState({
                isOpen: true,
                domain,
                type: 'block_source',
                source,
                sourceId,
                phrase: randomFocusPhrase(),
            });
            return;
        }
        await executeSourceRemoval(domain, source, sourceId);
    };

    const toggleCategory = async (category: SafeBlockCategoryKey) => {
        if (categoryPending || engineState.nuclearState?.active) return;
        setCategoryPending(category);
        const enabled = !engineState.categoriesActive?.[category];
        await mutateEngine(
            { type: 'CATEGORY_TOGGLE', category, enabled },
            (s) => ({ ...s, categoriesActive: { ...s.categoriesActive, [category]: enabled } }),
            `Could not update ${SAFE_BLOCK_CATEGORY_LABELS[category]}.`,
        );
        setCategoryPending(null);
    };

    const handleAddSite = async (kind: 'block' | 'allowed_site', altKey: boolean) => {
        const rawValue = kind === 'block' ? newBlocked : newAllowed;
        const value = rawValue.trim();
        if (!value || resolvingField) return;
        const clearInput = () => (kind === 'block' ? setNewBlocked('') : setNewAllowed(''));

        // "youtube" → youtube.com. Anything else that isn't an address goes to the
        // AI lookup for Pro (no Alt needed), or gets a clear hint — never a silent
        // entry that blocks nothing.
        if (!altKey && !looksLikeDomainOrUrl(value)) {
            if (/^[a-z0-9-]+$/i.test(value)) {
                clearInput();
                await triggerAction(kind, `${value.toLowerCase()}.com`, 'add');
                return;
            }
            if (!isPro) {
                setBlockActionError(`"${value}" isn't a web address — try something like youtube.com.`);
                return;
            }
            altKey = true;
        }

        if (altKey && !looksLikeDomainOrUrl(value)) {
            if (!isPro) {
                setBlockActionError('AI site lookup is a Pro feature — upgrade to resolve natural-language site names.');
                return;
            }
            if (!session?.access_token) {
                setBlockActionError('Sign in again to use the AI site resolver.');
                return;
            }
            setBlockActionError('');
            setResolvingField(kind);
            const resolved = await resolveSiteViaAI(value, session.access_token);
            setResolvingField(null);
            if (!resolved) {
                setBlockActionError(`Could not find a site for "${value}". Try typing the domain directly.`);
                return;
            }
            clearInput();
            await triggerAction(kind, resolved.domain, 'add');
            return;
        }

        clearInput();
        await triggerAction(kind, value, 'add');
    };

    const sendEngineMessage = <T extends { ok?: boolean; error?: string } = { ok?: boolean; error?: string }>(
        message: Record<string, unknown>,
    ) => new Promise<T>((resolve) =>
        chrome.runtime.sendMessage(message, (resp) => resolve((resp || { ok: false, error: chrome.runtime.lastError?.message }) as T)),
    );

    const quickActions: { id: string; label: string; icon: typeof Check; run: () => Promise<void> }[] = [
        {
            id: 'enable-categories',
            label: 'Enable all categories',
            icon: Check,
            run: async () => {
                for (const key of SAFE_BLOCK_CATEGORY_KEYS) {
                    if (engineState.categoriesActive?.[key]) continue;
                    const res = await sendEngineMessage({ type: 'CATEGORY_TOGGLE', category: key, enabled: true });
                    if (res.ok === false) throw new Error(res.error || `Could not enable ${SAFE_BLOCK_CATEGORY_LABELS[key]}`);
                }
            },
        },
        {
            id: 'disable-categories',
            label: 'Disable all categories',
            icon: X,
            run: async () => {
                for (const key of SAFE_BLOCK_CATEGORY_KEYS) {
                    if (!engineState.categoriesActive?.[key]) continue;
                    const res = await sendEngineMessage({ type: 'CATEGORY_TOGGLE', category: key, enabled: false });
                    if (res.ok === false) throw new Error(res.error || `Could not disable ${SAFE_BLOCK_CATEGORY_LABELS[key]}`);
                }
            },
        },
        {
            id: 'block-platforms',
            label: 'Block all platforms',
            icon: Ban,
            run: async () => {
                const res = await sendEngineMessage({
                    type: 'UPDATE_ENGINE_SETTINGS',
                    settings: {
                        inAppBlock: {
                            ...engineState.inAppBlock,
                            youtube: true, youtubeShorts: true, instagram: true, instagramReels: true, tiktok: true,
                        },
                    },
                });
                if (res.ok === false) throw new Error(res.error || 'Could not block platforms');
            },
        },
        {
            id: 'unblock-platforms',
            label: 'Unblock all platforms',
            icon: Globe,
            run: async () => {
                const res = await sendEngineMessage({
                    type: 'UPDATE_ENGINE_SETTINGS',
                    settings: {
                        inAppBlock: {
                            ...engineState.inAppBlock,
                            youtube: false, youtubeShorts: false, instagram: false, instagramReels: false, tiktok: false,
                        },
                    },
                });
                if (res.ok === false) throw new Error(res.error || 'Could not unblock platforms');
            },
        },
    ];

    const runQuickAction = async (action: { id: string; run: () => Promise<void> }) => {
        if (bulkActionPending || nuclearActive) return;
        setBulkActionPending(action.id);
        try {
            await action.run();
            setBlockActionError('');
        } catch (err) {
            setBlockActionError(err instanceof Error ? err.message : 'Could not complete that quick action.');
        } finally {
            await fetchEngineState();
            setBulkActionPending(null);
        }
    };

    const platformKeys = [
        { label: 'YouTube Shorts', key: 'youtubeShorts' as const, desc: 'Shorts feed and /shorts links', site: 'youtube.com' },
        { label: 'YouTube', key: 'youtube' as const, desc: 'All of YouTube', site: 'youtube.com' },
        { label: 'Instagram Reels', key: 'instagramReels' as const, desc: 'Reels tab and feed', site: 'instagram.com' },
        { label: 'Instagram', key: 'instagram' as const, desc: 'All of Instagram', site: 'instagram.com' },
        { label: 'TikTok', key: 'tiktok' as const, desc: 'All of TikTok', site: 'tiktok.com' },
    ];

    const togglePlatformBlock = async (key: (typeof platformKeys)[number]['key']) => {
        if (nuclearActive || platformPending) return;
        const current = engineState.inAppBlock || {};
        const nextOn = !current[key];
        setPlatformPending(key);
        const inAppBlock = { ...current, [key]: nextOn };
        await mutateEngine(
            { type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock } },
            (s) => ({ ...s, inAppBlock }),
            `Could not update ${key}.`,
        );
        setPlatformPending(null);
    };

    const categoriesOn = SAFE_BLOCK_CATEGORY_KEYS.filter((key) => engineState.categoriesActive?.[key]);
    const platformsOn = platformKeys.filter(({ key }) => engineState.inAppBlock?.[key]).length;
    const allowedSites: string[] = engineState.allowedSites || [];
    const smartYouTube = normalizeSmartYouTube(engineState.inAppBlock?.smartYouTube);
    const nuclearMinutesLeft = nuclearActive
        ? Math.max(0, Math.ceil((engineState.nuclearState.endTime - nowMs) / 60000))
        : 0;

    const blockedSites = Object.entries(engineState.blocklist || {})
        .map(([domain, entry]) => {
            const sources: { source: string; id?: string; label: string }[] = (entry.sources || []).flatMap((source: string) => {
                if (source === 'category') return [];
                if (source === 'timer') {
                    const timers = engineState.timers?.[domain] || [];
                    return timers.length
                        ? timers.map((timer: { id: string; endTime: number }) => ({
                              source,
                              id: timer.id as string,
                              label: `Timer until ${new Date(timer.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
                          }))
                        : [{ source, label: 'Timer' }];
                }
                if (source === 'schedule') {
                    const schedules = engineState.schedules?.[domain] || [];
                    const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    return schedules.length
                        ? schedules.map((s: { id: string; startHour: number; startMin: number; endHour: number; endMin: number }) => ({
                              source,
                              id: s.id as string,
                              label: `Scheduled ${hm(s.startHour, s.startMin)}–${hm(s.endHour, s.endMin)}`,
                          }))
                        : [{ source, label: 'Schedule' }];
                }
                if (source === 'manual') return [{ source, label: 'Always' }];
                if (source === 'ai') return [{ source, label: 'Added by AI Coach' }];
                return [{ source, label: source.charAt(0).toUpperCase() + source.slice(1) }];
            });
            return { domain, sources };
        })
        .filter((site) => site.sources.length > 0)
        .sort((a, b) => a.domain.localeCompare(b.domain));

    const nothingBlocked = categoriesOn.length === 0 && blockedSites.length === 0;

    const cardHeader = (title: string, meta?: ReactNode, action?: ReactNode) => (
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-[var(--fz-text-1)]">{title}</h3>
                {meta && <p className="text-meta mt-0.5">{meta}</p>}
            </div>
            {action}
        </div>
    );

    const rowIcon = 'flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-hover)] text-[var(--fz-text-3)]';

    return (
        <div className="space-y-4 animate-fade-in-up">
            <SmartYouTubeModal
                open={smartYtOpen}
                onClose={() => setSmartYtOpen(false)}
                settings={smartYouTube}
                onSave={patchSmartYouTube}
            />
            <ChallengeModal
                isOpen={challengeState.isOpen}
                phrase={challengeState.phrase}
                error={blockActionError}
                onClose={() => setChallengeState((prev) => ({ ...prev, isOpen: false }))}
                onComplete={() => challengeState.source
                    ? executeSourceRemoval(challengeState.domain, challengeState.source, challengeState.sourceId)
                    : executeAction(challengeState.type, challengeState.domain, 'remove')}
                onDisableChallenge={disableChallenge}
            />

            {nuclearActive && (
                <Banner tone="warn" title={`Nuclear lockdown · ${nuclearMinutesLeft}m left`}>
                    Your blocklist is locked until it ends — nothing on this page can be turned off.
                </Banner>
            )}
            {blockActionError && !challengeState.isOpen && (
                <Banner tone="danger" onDismiss={() => setBlockActionError('')}>
                    {blockActionError}
                </Banner>
            )}

            {/* Add a site — the main thing people come here to do */}
            <GlassCard className="p-5">
                <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleAddSite('block', false);
                    }}
                >
                    <label className="relative flex min-w-0 flex-1 items-center">
                        <Ban size={15} className="pointer-events-none absolute left-3 text-[var(--fz-text-4)]" />
                        <input
                            value={newBlocked}
                            onChange={(e) => setNewBlocked(e.target.value)}
                            disabled={resolvingField === 'block'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.altKey) {
                                    e.preventDefault();
                                    void handleAddSite('block', true);
                                }
                            }}
                            placeholder="Block a site — youtube.com, reddit.com/r/all…"
                            aria-label="Site to block"
                            className="h-10 w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] pl-9 pr-3 text-[14px] text-[var(--fz-text-1)] outline-none transition-colors placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)] disabled:opacity-60"
                        />
                    </label>
                    <Button type="submit" variant="primary" size="lg" loading={resolvingField === 'block'} disabled={!newBlocked.trim()}>
                        Block
                    </Button>
                </form>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <p className="text-meta">
                        <span className="font-medium text-[var(--fz-text-2)]">{blockedSites.length}</span> {noun(blockedSites.length, 'site')}
                        <span className="mx-1.5 text-[var(--fz-text-4)]">·</span>
                        <span className="font-medium text-[var(--fz-text-2)]">{categoriesOn.length}</span> {noun(categoriesOn.length, 'category', 'categories')}
                        <span className="mx-1.5 text-[var(--fz-text-4)]">·</span>
                        <span className="font-medium text-[var(--fz-text-2)]">{platformsOn}</span> {noun(platformsOn, 'platform')}
                    </p>
                    <p className="text-meta flex items-center gap-1.5">
                        <Kbd>Alt</Kbd>
                        <span className="text-[var(--fz-text-4)]">+</span>
                        <Kbd>Enter</Kbd>
                        <span>finds a site by name{isPro ? '' : ' (Pro)'}</span>
                    </p>
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                    {/* What's blocked right now */}
                    <GlassCard>
                        {cardHeader(
                            'Blocked',
                            nothingBlocked ? 'Nothing yet' : `${blockedSites.length} ${noun(blockedSites.length, 'site')} · ${categoriesOn.length} ${noun(categoriesOn.length, 'category', 'categories')}`,
                        )}
                        {nothingBlocked ? (
                            <EmptyState
                                className="pb-10 pt-4"
                                icon={<ShieldOff size={15} />}
                                title="Nothing is blocked yet"
                                description="Block a site above, or switch on a category like Social media."
                            />
                        ) : (
                            <div className="max-h-[560px] divide-y divide-[var(--fz-border)] overflow-y-auto border-t border-[var(--fz-border)] scrollbar-hide">
                                {categoriesOn.map((category) => {
                                    const Icon = CATEGORY_ICONS[category];
                                    const expanded = !!expandedBlockedCategories[category];
                                    const sites = SAFE_BLOCK_CATEGORIES[category];
                                    return (
                                        <div key={`cat-${category}`}>
                                            <div className="group/row flex min-h-12 items-center gap-3 px-5 py-2">
                                                <span className={rowIcon}>
                                                    <Icon size={14} strokeWidth={1.75} />
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedBlockedCategories((prev) => ({ ...prev, [category]: !prev[category] }))}
                                                    aria-expanded={expanded}
                                                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-[13px] font-medium text-[var(--fz-text-1)]">
                                                            {SAFE_BLOCK_CATEGORY_LABELS[category]}
                                                        </span>
                                                        <span className="text-meta block">Category · {sites.length} sites</span>
                                                    </span>
                                                    <ChevronDown
                                                        size={13}
                                                        className={`shrink-0 text-[var(--fz-text-4)] transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {!nuclearActive && (
                                                    <IconButton
                                                        icon={<X size={14} />}
                                                        tooltip={`Stop blocking ${SAFE_BLOCK_CATEGORY_LABELS[category]}`}
                                                        onClick={() => void toggleCategory(category)}
                                                        className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
                                                    />
                                                )}
                                            </div>
                                            {expanded && (
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 pb-3 pl-[60px] sm:grid-cols-3">
                                                    {sites.map((domain) => (
                                                        <span key={domain} className="truncate text-[12px] text-[var(--fz-text-3)]">
                                                            {domain}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {blockedSites.map(({ domain, sources }) => (
                                    <div key={domain} className="group/row flex min-h-12 items-center gap-3 px-5 py-2">
                                        <SiteIcon domain={domain} />
                                        <div className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-medium text-[var(--fz-text-1)]">{domain}</span>
                                            <span className="text-meta block truncate">{sources.map((s) => s.label).join(' · ')}</span>
                                        </div>
                                        {!nuclearActive && (
                                            sources.length === 1 ? (
                                                <IconButton
                                                    icon={<X size={14} />}
                                                    tooltip={`Unblock ${domain}`}
                                                    onClick={() => triggerSourceRemoval(domain, sources[0].source, sources[0].id)}
                                                    className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
                                                />
                                            ) : (
                                                <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
                                                    {sources.map((s, i) => (
                                                        <button
                                                            key={`${s.source}-${s.id || i}`}
                                                            type="button"
                                                            onClick={() => triggerSourceRemoval(domain, s.source, s.id)}
                                                            className="flex h-6 items-center gap-1 rounded-md bg-[var(--fz-bg-hover)] pl-2 pr-1.5 text-[11.5px] text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-active)] hover:text-[var(--fz-text-1)]"
                                                            aria-label={`Remove ${s.label.toLowerCase()} block for ${domain}`}
                                                        >
                                                            {s.label}
                                                            <X size={11} />
                                                        </button>
                                                    ))}
                                                </span>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>

                    {/* Always allowed */}
                    <GlassCard>
                        {cardHeader('Always allowed', 'Stay reachable even while blocks run')}
                        <form
                            className="flex gap-2 px-5"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void handleAddSite('allowed_site', false);
                            }}
                        >
                            <input
                                value={newAllowed}
                                onChange={(e) => setNewAllowed(e.target.value)}
                                disabled={resolvingField === 'allowed_site'}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.altKey) {
                                        e.preventDefault();
                                        void handleAddSite('allowed_site', true);
                                    }
                                }}
                                placeholder="docs.google.com"
                                aria-label="Site to always allow"
                                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none transition-colors placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)] disabled:opacity-60"
                            />
                            <Button type="submit" variant="secondary" loading={resolvingField === 'allowed_site'} disabled={!newAllowed.trim()}>
                                Add
                            </Button>
                        </form>
                        <div className="px-3 pb-2 pt-2">
                            {allowedSites.length === 0 ? (
                                <p className="text-meta px-2 py-3">No exceptions yet.</p>
                            ) : (
                                <div className="max-h-[240px] overflow-y-auto scrollbar-hide">
                                    {allowedSites.map((domain) => (
                                        <div key={domain} className="group/row flex h-10 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--fz-bg-hover)]">
                                            <SiteIcon domain={domain} size="sm" />
                                            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--fz-text-1)]">{domain}</span>
                                            <IconButton
                                                icon={<X size={14} />}
                                                tooltip={`Remove ${domain}`}
                                                onClick={() => triggerAction('allowed_site', domain, 'remove')}
                                                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 border-t border-[var(--fz-border)] px-5 py-3">
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13px] text-[var(--fz-text-1)]">Allowlist mode</span>
                                <span className="text-meta block">
                                    {allowedSites.length === 0
                                        ? 'Add a site first — then everything else can be blocked'
                                        : engineState.allowlistMode
                                          ? 'On — only these sites work'
                                          : 'Block every site except these'}
                                </span>
                            </span>
                            <Switch
                                checked={!!engineState.allowlistMode}
                                disabled={allowedSites.length === 0 || nuclearActive}
                                onCheckedChange={(next) => {
                                    void mutateEngine(
                                        { type: 'UPDATE_ENGINE_SETTINGS', settings: { allowlistMode: next } },
                                        (s) => ({ ...s, allowlistMode: next }),
                                        'Could not change allowlist mode.',
                                    );
                                }}
                                aria-label="Allowlist mode"
                            />
                        </div>
                    </GlassCard>

                    {/* Nuclear lockdown */}
                    <GlassCard>
                        {cardHeader(
                            'Nuclear lockdown',
                            'Locks everything on your blocklist. It can’t be undone until the timer ends.',
                            <Zap size={15} className="mt-0.5 shrink-0 text-[var(--fz-danger)]" />,
                        )}
                        {nuclearActive ? (
                            <div className="px-5 pb-5">
                                <div className="rounded-lg border border-[var(--fz-border)] bg-[var(--fz-danger-soft)] px-4 py-5 text-center">
                                    <p className="text-[28px] font-semibold tabular-nums leading-none text-[var(--fz-text-1)]">
                                        {nuclearMinutesLeft}m
                                    </p>
                                    <p className="text-meta mt-2">left in lockdown</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 px-5 pb-5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <SegmentedControl
                                        size="sm"
                                        idPrefix="nuke-duration"
                                        value={[15, 30, 60, 120].includes(nuclearDuration) ? String(nuclearDuration) : 'custom'}
                                        onChange={(v) => {
                                            if (v !== 'custom') setNuclearDuration(Number(v));
                                        }}
                                        options={[
                                            { value: '15', label: '15m' },
                                            { value: '30', label: '30m' },
                                            { value: '60', label: '1h' },
                                            { value: '120', label: '2h' },
                                            ...(![15, 30, 60, 120].includes(nuclearDuration) ? [{ value: 'custom', label: 'Custom' }] : []),
                                        ]}
                                    />
                                    <label className="flex h-8 items-center gap-1 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5">
                                        <input
                                            type="number"
                                            min={1}
                                            value={nuclearDuration}
                                            onChange={(e) => setNuclearDuration(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                            aria-label="Lockdown minutes"
                                            className="w-10 bg-transparent text-[13px] tabular-nums text-[var(--fz-text-1)] outline-none"
                                        />
                                        <span className="text-meta">min</span>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-meta">
                                        {blocklistCount === 0
                                            ? 'Block at least one site first.'
                                            : `Locks ${blocklistCount} ${noun(blocklistCount, 'site')} for ${nuclearDuration} min.`}
                                    </p>
                                    <Button
                                        variant="danger-solid"
                                        disabled={blocklistCount === 0}
                                        onClick={() => setNukeModalOpen(true)}
                                    >
                                        Start lockdown
                                    </Button>
                                </div>
                            </div>
                        )}
                    </GlassCard>
                </div>

                <div className="space-y-4">
                    {/* Categories */}
                    <GlassCard>
                        {cardHeader(
                            'Categories',
                            `${categoriesOn.length} of ${SAFE_BLOCK_CATEGORY_KEYS.length} on`,
                            <BulkMenu
                                label="Category actions"
                                disabled={nuclearActive || !!bulkActionPending}
                                pending={bulkActionPending === 'enable-categories' || bulkActionPending === 'disable-categories'}
                                items={[
                                    { id: 'enable-categories', label: 'Turn all on', icon: <Check size={13} />, onSelect: () => void runQuickAction(quickActions[0]) },
                                    { id: 'disable-categories', label: 'Turn all off', icon: <X size={13} />, onSelect: () => void runQuickAction(quickActions[1]) },
                                ]}
                            />,
                        )}
                        <div className="px-3 pb-3">
                            {SAFE_BLOCK_CATEGORY_KEYS.map((category) => {
                                const Icon = CATEGORY_ICONS[category];
                                const active = !!engineState.categoriesActive?.[category];
                                return (
                                    <div key={category} className="flex h-11 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--fz-bg-hover)]">
                                        <Icon size={15} strokeWidth={1.75} className="shrink-0 text-[var(--fz-text-3)]" />
                                        <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--fz-text-1)]">
                                            {SAFE_BLOCK_CATEGORY_LABELS[category]}
                                        </span>
                                        <span className="text-meta shrink-0 tabular-nums">
                                            {categoryPending === category ? 'Updating…' : `${SAFE_BLOCK_CATEGORIES[category].length} sites`}
                                        </span>
                                        <Switch
                                            checked={active}
                                            disabled={categoryPending !== null || nuclearActive}
                                            onCheckedChange={() => void toggleCategory(category)}
                                            aria-label={`Block ${SAFE_BLOCK_CATEGORY_LABELS[category]}`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>

                    {/* Platforms */}
                    <GlassCard>
                        {cardHeader(
                            'Platforms',
                            'Feeds and short videos inside apps',
                            <BulkMenu
                                label="Platform actions"
                                disabled={nuclearActive || !!bulkActionPending}
                                pending={bulkActionPending === 'block-platforms' || bulkActionPending === 'unblock-platforms'}
                                items={[
                                    { id: 'block-platforms', label: 'Block all', icon: <Ban size={13} />, onSelect: () => void runQuickAction(quickActions[2]) },
                                    { id: 'unblock-platforms', label: 'Unblock all', icon: <Globe size={13} />, onSelect: () => void runQuickAction(quickActions[3]) },
                                ]}
                            />,
                        )}
                        <div className="px-3 pb-3">
                            {platformKeys.map(({ label, key, desc, site }) => (
                                <div key={key} className="flex h-12 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--fz-bg-hover)]">
                                    <SiteIcon domain={site} size="sm" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] text-[var(--fz-text-1)]">{label}</span>
                                        <span className="text-meta block truncate">{platformPending === key ? 'Updating…' : desc}</span>
                                    </span>
                                    <Switch
                                        checked={!!engineState.inAppBlock?.[key]}
                                        disabled={nuclearActive || !!platformPending}
                                        onCheckedChange={() => void togglePlatformBlock(key)}
                                        aria-label={`Block ${label}`}
                                    />
                                </div>
                            ))}
                            <div className="mt-1 flex h-12 items-center gap-3 border-t border-[var(--fz-border)] px-2 pt-1">
                                <Sparkles size={15} strokeWidth={1.75} className="shrink-0 text-[var(--fz-text-3)]" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] text-[var(--fz-text-1)]">Smart YouTube</span>
                                    <span className="text-meta block truncate">
                                        {smartYouTube.enabled
                                            ? `On · ${smartYouTube.blockedCategoryIds.length} video ${noun(smartYouTube.blockedCategoryIds.length, 'type')} blocked`
                                            : 'Block videos by topic, keep the useful ones'}
                                    </span>
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => setSmartYtOpen(true)}>
                                    {smartYouTube.enabled ? 'Edit' : 'Set up'}
                                </Button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>

            <NuclearConfirmModal
                open={nukeModalOpen}
                durationMin={nuclearDuration}
                blocklistCount={blocklistCount}
                onDurationChange={setNuclearDuration}
                onClose={() => setNukeModalOpen(false)}
                onConfirm={async () => {
                    setNukeModalOpen(false);
                    const response = await chrome.runtime.sendMessage({
                        type: 'START_NUCLEAR',
                        target: 'blocked',
                        duration: nuclearDuration,
                    });
                    if (response?.ok === false) {
                        setBlockActionError(response.error || 'Nuclear lockdown could not be started.');
                        return;
                    }
                    setBlockActionError('');
                    await fetchEngineState();
                }}
            />
        </div>
    );
};

/** Stats lives in its own file now; OptionsApp still imports it from here. */
export { default as StatisticsTab } from './StatsTab';

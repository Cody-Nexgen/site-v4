import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import { dispatchFocusComplete } from '../lib/proDashboard';
import {
    POMODORO_RUNTIME_KEY,
    computeTimeLeft,
    createResetPomodoroRuntime,
    readPomodoroRuntime,
    writePomodoroRuntime,
    type PomodoroRuntime,
} from '../lib/pomodoroRuntime';
import { GlassCard } from './OptionsApp';
import CalendarView from './CalendarView';
import { 
    Play, Pause, RefreshCw, Plus,
    Trash, Check, Ban, Globe, Zap, X,
    AlertTriangle, TrendingDown, Lightbulb,
} from 'lucide-react';
import { HabitCheckInButton } from '../components/pro-dashboard/HabitCheckInButton';
import { IconCalendarStats } from '@tabler/icons-react';
import { SemiDonutChart, semiDonutMetrics } from '../lib/semiDonutChart';
import { capDayScreenMs } from '../lib/screenTimeCap';
import { ChallengeModal, randomFocusPhrase } from '../lib/unblockChallenge';
import { sendProgressionMessage } from '../hooks/useFocusProgression';
import HabitNameModal from '../components/HabitNameModal';
import { FocusActivityChart } from '../components/FocusActivityChart';
import { detectProcrastinationPatterns } from '../lib/procrastinationPatterns';
import { detectOverridePatterns, type EmergencyOverrideEntry } from '../lib/emergencyOverride';
import { computeFocusScore, focusScoreColor, computeAllTimeFocusScore } from '../lib/focusScore';
import { NuclearConfirmModal } from '../components/NuclearConfirmModal';
import {
    SAFE_BLOCK_CATEGORIES,
    SAFE_BLOCK_CATEGORY_KEYS,
    SAFE_BLOCK_CATEGORY_LABELS,
    type SafeBlockCategoryKey,
} from '../lib/blockCategories';
import { FutureSelfContractModal } from '../components/FutureSelfContractModal';
import type { FutureSelfContract } from '../lib/futureSelfTypes';

export const InboxTab = () => (
    <div className="space-y-6 animate-fade-in-up max-w-[1200px] mx-auto">
        <div>
            <p className="focuz-section-label">Workspace</p>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Inbox</h1>
            <p className="text-sm text-neutral-500 mt-1">Captured thoughts and incoming integrations.</p>
        </div>
        <GlassCard className="p-8 flex flex-col items-center justify-center h-64 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Empty inbox</span>
            <span className="text-sm text-neutral-400">All captured thoughts and incoming integrations will appear here.</span>
        </GlassCard>
    </div>
);

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
                    className="absolute right-1 top-0 z-20 flex rounded-lg border border-white/[0.08] bg-black/50 p-0.5 shadow-sm backdrop-blur"
                    role="group"
                    aria-label="Focus score chart type"
                >
                    {(['bar', 'line'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setChartMode(mode)}
                            aria-pressed={chartMode === mode}
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors ${
                                chartMode === mode ? 'bg-white/[0.12] text-white' : 'text-neutral-500 hover:text-neutral-300'
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
                            <text x={4} y={getY(v) + 4} className="text-[10px] fill-neutral-600 font-medium">{v}</text>
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
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.65, ease: 'easeOut' }}
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
                                        stroke={active ? '#fff' : focusScoreColor(p.score)}
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
                                <text x={chartMode === 'bar' ? x + barW / 2 : pointX} y={height - 8} textAnchor="middle" className="text-[10px] fill-neutral-600 font-medium">
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
        medium: 'border-amber-500/30 bg-amber-500/10',
        low: 'border-blue-500/30 bg-blue-500/10',
    };

    const formatTime = (ms: number) => {
        const mins = Math.round(capDayScreenMs(ms) / 60000);
        if (mins < 60) return `${mins}m`;
        return `${(mins / 60).toFixed(1)}h`;
    };

    return (
        <div className="space-y-8 animate-fade-in-up max-w-[1200px] mx-auto pb-20">
            <div>
                <p className="focuz-section-label">Insights</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Patterns</h1>
                <p className="text-sm text-neutral-500 mt-1">Activity trends and focus insights — all computed locally.</p>
            </div>

            {/* Activity heatmap */}
            <GlassCard className="p-5">
                <h3 className="font-semibold text-white text-sm mb-1">Focus activity</h3>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-4">Last 12 weeks · darker green = higher focuz score</p>
                <FocusActivityChart stats={allStats} weeks={12} />
            </GlassCard>

            {/* Weekly stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <GlassCard className="p-5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Today&apos;s score</span>
                    <p className="text-2xl font-semibold tabular-nums mt-1" style={{ color: focusScoreColor(focusResult.score) }}>{focusResult.score}</p>
                    <p className="text-xs text-neutral-500">{focusResult.label}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">All-time score</span>
                    <p className="text-2xl font-semibold tabular-nums mt-1" style={{ color: focusScoreColor(allTime.score) }}>{allTime.score}</p>
                    <p className="text-xs text-neutral-500">{allTime.daysCounted > 0 ? `Avg · ${allTime.daysCounted} days` : 'No data yet'}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Usage today</span>
                    <p className="text-2xl font-semibold tabular-nums text-white mt-1">{formatTime(todayData?.total ?? 0)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Blocks today</span>
                    <p className="text-2xl font-semibold tabular-nums text-white mt-1">{engineState.blockedToday ?? 0}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Activity streak</span>
                    <p className="text-2xl font-semibold tabular-nums text-purple-400 mt-1">{streak}<span className="text-sm text-neutral-500 ml-1">d</span></p>
                </GlassCard>
            </div>

            {/* Weekly focus score graph */}
            <GlassCard className="p-5">
                <h3 className="font-semibold text-white text-sm mb-1">Weekly focuz scores</h3>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-4">Last 7 days · 0–100</p>
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
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/[0.12] flex items-center justify-center">
                                <Lightbulb size={22} className="text-purple-400" />
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
                                        <TrendingDown size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <h4 className="font-semibold text-white">{p.title}</h4>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-neutral-400">
                                                {p.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-400 mb-3 leading-relaxed">{p.detail}</p>
                                        <p className="text-sm text-purple-300/90 leading-relaxed">
                                            <span className="font-semibold text-purple-400 block mb-1">Try this</span>
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

export const ExportsTab = () => (
    <div className="space-y-6 animate-fade-in-up max-w-[1200px] mx-auto">
        <div>
            <p className="focuz-section-label">Insights</p>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Exports</h1>
            <p className="text-sm text-neutral-500 mt-1">Download your focus data.</p>
        </div>
        <GlassCard className="p-8 flex flex-col items-center justify-center h-64 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Export data</span>
            <span className="text-sm text-neutral-400">CSV and JSON exports will be available here soon.</span>
        </GlassCard>
    </div>
);

// Removed standalone NotesTab - merged into SessionsTab

const HABITS_TIP_KEY = 'focuznow_hide_habits_tip';

export const HabitsTab = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const habits = engineState.habits || [];
    const todayStr = new Date().toDateString();
    const [showTip, setShowTip] = useState(() => !localStorage.getItem(HABITS_TIP_KEY));
    const [habitModalOpen, setHabitModalOpen] = useState(false);

    const addHabitByName = async (name: string) => {
        const updated = [...habits, { id: Date.now(), name, streak: 0, checkins: [], lastCheckin: '' }];
        await new Promise<void>(r =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } },
                () => r(),
            ),
        );
        fetchEngineState();
    };

    const checkInHabit = async (id: number) => {
        const updated = habits.map((h: any) => {
            if (h.id !== id) return h;
            if (h.checkins?.includes(todayStr)) return h;
            
            // Check if streak continues (was it checked in yesterday?)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();
            const continues = h.lastCheckin === yesterdayStr || h.streak === 0;
            
            return { 
                ...h, 
                checkins: [...(h.checkins || []), todayStr], 
                streak: continues ? (h.streak || 0) + 1 : 1,
                lastCheckin: todayStr
            };
        });
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
        await fetchEngineState();
        await sendProgressionMessage({ type: 'PROGRESSION_HABIT_CHECKIN', habitId: id });
        useAuthStore.getState().recalculateStreak();
    };

    const removeHabit = async (id: number) => {
        if (!confirm('Remove this habit? Your streak will be lost.')) return;
        const updated = habits.filter((h: any) => h.id !== id);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
        fetchEngineState();
    };

    return (
        <div className="space-y-6 animate-fade-in-up max-w-[1200px] mx-auto">
            {showTip && (
                <GlassCard className="p-4 border-purple-500/20 bg-purple-950/20 relative">
                    <button
                        type="button"
                        onClick={() => {
                            localStorage.setItem(HABITS_TIP_KEY, '1');
                            setShowTip(false);
                        }}
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 text-sm font-semibold transition-colors duration-150"
                        aria-label="Dismiss tip"
                    >
                        ×
                    </button>
                    <p className="text-sm text-neutral-300 leading-relaxed pr-8">
                        <span className="font-semibold text-white">How to track:</span> Add a habit, then tap the large check-in button each day. Your streak grows when you check in on consecutive days. You can also check in from the Dashboard habits grid.
                    </p>
                </GlassCard>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <p className="focuz-section-label">Progress</p>
                    <h1 className="text-3xl font-semibold text-white tracking-tight">Habits</h1>
                    <p className="text-sm text-neutral-500 mt-1">Build discipline through consistency.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setHabitModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors duration-150 flex items-center gap-1.5"
                >
                    <Plus size={14} />
                    <span>New habit</span>
                </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                {habits.length === 0 ? (
                    <GlassCard className="p-16 flex flex-col items-center justify-center text-center mx-auto max-w-lg">
                        <div className="w-16 h-16 min-w-[4rem] min-h-[4rem] shrink-0 bg-white/5 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                            <IconCalendarStats size={32} className="text-neutral-500 shrink-0" stroke={1.5} />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">No active habits</p>
                        <p className="text-neutral-500 text-sm mt-2 max-w-xs">Start your first streak by adding a habit above.</p>
                    </GlassCard>
                ) : (
                    habits.map((h: any) => {
                        const checkedToday = h.checkins?.includes(todayStr);
                        return (
                            <GlassCard key={h.id} className="p-5 group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-6">
                                        <HabitCheckInButton
                                            checked={checkedToday}
                                            onCheckIn={() => checkInHabit(h.id)}
                                        />
                                        <div>
                                            <p className={`text-lg font-semibold transition-colors duration-150 ${checkedToday ? 'text-purple-400' : 'text-white'}`}>{h.name}</p>
                                            <div className="flex items-center space-x-3 mt-1">
                                                <div className="flex items-center space-x-1">
                                                    <Zap size={12} className={h.streak > 0 ? 'text-orange-400' : 'text-neutral-600'} />
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{h.streak || 0} day streak</span>
                                                </div>
                                                <span className="text-neutral-800">•</span>
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                                                    {checkedToday ? 'Completed today' : 'Pending check-in'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-6">
                                        {/* Simple Heatmap dots */}
                                        <div className="hidden sm:flex space-x-1.5">
                                            {Array.from({ length: 14 }).map((_, i) => {
                                                const d = new Date();
                                                d.setDate(d.getDate() - (13 - i));
                                                const ds = d.toDateString();
                                                const checked = h.checkins?.includes(ds);
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`w-3 h-3 rounded-[3px] transition-colors duration-150
                                                            ${checked ? 'bg-purple-500' : 'bg-white/5'}`}
                                                        title={ds}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <button onClick={() => removeHabit(h.id)} className="p-3 text-neutral-600 hover:text-red-400 transition-colors duration-150 opacity-0 group-hover:opacity-100 bg-white/[0.06] hover:bg-red-400/10 rounded-xl">
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>
                            </GlassCard>
                        );
                    })
                )}
            </div>
            <HabitNameModal
                open={habitModalOpen}
                onClose={() => setHabitModalOpen(false)}
                onSubmit={addHabitByName}
            />
        </div>
    );
};

export const TasksTab = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const planner = engineState.dailyPlanner || [];
    const [newPlanTime, setNewPlanTime] = useState('09:00');
    const [newPlanTask, setNewPlanTask] = useState('');

    const addPlanItem = async () => {
        if (!newPlanTask.trim()) return;
        const updated = [...planner, { id: Date.now(), time: newPlanTime, task: newPlanTask, done: false }].sort((a: any, b: any) => a.time.localeCompare(b.time));
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        setNewPlanTask('');
        fetchEngineState();
    };

    const togglePlanItem = async (id: number) => {
        const updated = planner.map((p: any) => p.id === id ? { ...p, done: !p.done } : p);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    const removePlanItem = async (id: number) => {
        const updated = planner.filter((p: any) => p.id !== id);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    return (
        <div className="space-y-6 animate-fade-in-up max-w-[1400px] mx-auto">
            <div>
                <p className="focuz-section-label">Workspace</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Tasks & Planning</h1>
                <p className="text-sm text-neutral-500 mt-1">Plan your day and keep it on schedule.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
                <GlassCard className="p-5 h-[750px] flex flex-col">
                    <div className="flex space-x-3 mb-6">
                        <input type="time" value={newPlanTime} onChange={e => setNewPlanTime(e.target.value)}
                            className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors duration-150 w-32" />
                        <input value={newPlanTask} onChange={e => setNewPlanTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlanItem()}
                            placeholder="What needs to get done?"
                            className="flex-1 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors duration-150 min-w-0" />
                        <button onClick={addPlanItem} className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors duration-150 whitespace-nowrap">Add</button>
                    </div>
                    
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                        {planner.map((p: any) => (
                            <div key={p.id} className="flex items-center space-x-4 p-4 bg-[#111] border border-white/5 rounded-xl group hover:border-white/10 transition-colors duration-150">
                                <button onClick={() => togglePlanItem(p.id)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-150 flex-shrink-0 ${p.done ? 'bg-purple-500' : 'bg-white/10'}`}>
                                    {p.done && <Check size={14} className="text-white" />}
                                </button>
                                <span className="text-xs font-semibold text-purple-400 tabular-nums w-12 flex-shrink-0">{p.time}</span>
                                <span className={`flex-1 text-sm font-medium truncate ${p.done ? 'line-through text-neutral-500' : 'text-white'}`}>{p.task}</span>
                                <button onClick={() => removePlanItem(p.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-colors duration-150 flex-shrink-0"><Trash size={16} /></button>
                            </div>
                        ))}
                        {planner.length === 0 && <p className="text-neutral-600 text-sm text-center py-8">Plan your day. Add tasks above.</p>}
                    </div>
                </GlassCard>

                {/* Calendar Integrated */}
                <div className="h-[750px]">
                    <CalendarView />
                </div>
            </div>
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
            if (msg.type === 'POMODORO_SEGMENT_DONE') {
                void readPomodoroRuntime().then((rt) => {
                    applyRuntimeToUi(rt);
                    fetchEngineState();
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
        timerRef.current = window.setInterval(() => {
            setPomoTimeLeft(Math.max(0, Math.ceil((pomoEndAt - Date.now()) / 1000)));
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [pomoRunning, pomoEndAt]);

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
        <div className="mx-auto max-w-[980px] animate-fade-in-up space-y-5">
            <div className="text-center">
                <p className="focuz-section-label">Focus</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--dashboard-text)]">Focus sessions</h1>
                <p className="mt-1 text-sm text-[var(--dashboard-text-muted)]">Choose a rhythm, start the clock, and stay with one thing.</p>
            </div>
            {pomoNotice && (
                <div role="status" className="mx-auto max-w-xl rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-medium text-emerald-400">
                    {pomoNotice}
                </div>
            )}
            
            <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <GlassCard className="flex min-h-[500px] w-full flex-col items-center justify-center p-7 sm:p-9">
                    <span className={`mb-5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        isBreak ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                        {isBreak ? 'Recovery break' : pomoRunning ? 'Focus in progress' : 'Ready to focus'}
                    </span>

                    <div className="flex w-full items-center justify-center">
                        <div className="relative h-64 w-64 shrink-0 sm:h-72 sm:w-72">
                            <svg
                                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                                viewBox="0 0 200 200"
                                aria-hidden
                            >
                                <circle cx="100" cy="100" r="82" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                                <circle
                                    cx="100"
                                    cy="100"
                                    r="82"
                                    fill="none"
                                    stroke={isBreak ? '#22c55e' : '#a855f7'}
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 82}`}
                                    strokeDashoffset={`${2 * Math.PI * 82 * (1 - Math.min(1, pomoTimeLeft / segmentSeconds))}`}
                                    className="transition-all duration-1000"
                                />
                            </svg>
                            <div className="pointer-events-none absolute inset-[18%] flex flex-col items-center justify-center text-center">
                                <span className="text-5xl font-semibold leading-none tracking-[-0.04em] text-[var(--dashboard-text)] tabular-nums">
                                    {formatTime(pomoTimeLeft)}
                                </span>
                                <span className="mt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--dashboard-text-muted)]">
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
                            className={`flex min-w-32 items-center justify-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium transition-colors ${pomoRunning ? 'border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] text-[var(--dashboard-text)] hover:bg-[var(--dashboard-interactive-hover)]' : 'bg-[var(--dashboard-text)] text-[var(--dashboard-bg)] opacity-95 hover:opacity-100'}`}>
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
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-interactive-hover)] hover:text-[var(--dashboard-text)]">
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
                                    <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-purple-400">Pro</span>
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
                                    } else {
                                        setFutureSelfEnabled((enabled) => !enabled);
                                    }
                                }}
                                className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${futureSelfEnabled ? 'bg-purple-600' : 'bg-white/10'}`}
                            >
                                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${futureSelfEnabled ? 'translate-x-1' : '-translate-x-4'}`} />
                            </button>
                        </div>
                    </GlassCard>
                    <GlassCard className="p-4">
                        <h2 className="text-sm font-medium text-[var(--dashboard-text)]">Session presets</h2>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Set your focus cadence.</p>
                        <div className="mt-3 space-y-1.5">
                            {sessionPresets.map((preset) => {
                                const selected = pomoTiming.focusMin === preset.focus && pomoTiming.breakMin === preset.rest;
                                return (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        disabled={pomoRunning}
                                        onClick={() => void updatePomodoroSettings(preset.focus, preset.rest)}
                                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                            selected
                                                ? 'border-purple-500/35 bg-purple-500/10'
                                                : 'border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] hover:bg-[var(--dashboard-interactive-hover)]'
                                        }`}
                                    >
                                        <span className="text-xs font-medium text-[var(--dashboard-text)]">{preset.label}</span>
                                        <span className="text-[11px] text-[var(--dashboard-text-muted)]">{preset.focus} / {preset.rest} min</span>
                                    </button>
                                );
                            })}
                        </div>
                    </GlassCard>
                    <GlassCard className="p-4">
                        <div className="flex items-end justify-between border-b border-[var(--dashboard-border)] pb-3">
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--dashboard-text-muted)]">Today</p>
                                <p className="mt-1 text-2xl font-semibold text-[var(--dashboard-text)] tabular-nums">{completedToday}</p>
                            </div>
                            <p className="pb-1 text-xs text-[var(--dashboard-text-muted)]">completed sessions</p>
                        </div>
                        <div className="flex items-center justify-between pt-3">
                            <span className="text-xs text-[var(--dashboard-text-muted)]">Current streak</span>
                            <span className="text-xs font-medium text-[var(--dashboard-text)]">{dashboardStreak} days</span>
                        </div>
                    </GlassCard>
                    <GlassCard className="p-4">
                        <h2 className="text-sm font-medium text-[var(--dashboard-text)]">Custom timing</h2>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--dashboard-text-muted)]">
                                Focus
                                <input
                                    type="number"
                                    min="0.5"
                                    max="120"
                                    step="0.5"
                                    value={pomoTiming.focusMin}
                                    onChange={(event) => void updatePomodoroSettings(parseFloat(event.target.value) || 25, pomoTiming.breakMin)}
                                    className="mt-1.5 w-full rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] px-2 py-2 text-center text-xs text-[var(--dashboard-text)] outline-none"
                                />
                            </label>
                            <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--dashboard-text-muted)]">
                                Break
                                <input
                                    type="number"
                                    min="0.5"
                                    max="60"
                                    step="0.5"
                                    value={pomoTiming.breakMin}
                                    onChange={(event) => void updatePomodoroSettings(pomoTiming.focusMin, parseFloat(event.target.value) || 5)}
                                    className="mt-1.5 w-full rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] px-2 py-2 text-center text-xs text-[var(--dashboard-text)] outline-none"
                                />
                            </label>
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

export const BlocklistTab = () => {
    const { engineState, fetchEngineState } = useAuthStore();

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

    const executeAction = async (type: string, domain: string, action: 'add' | 'remove') => {
        const response = await new Promise<{ ok?: boolean; error?: string }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: `${action.toUpperCase()}_${type.toUpperCase()}`, domain: domain.trim() },
                (resp) => resolve(resp || { ok: false, error: chrome.runtime.lastError?.message }),
            ),
        );
        if (response.ok === false) {
            setBlockActionError(response.error || 'The blocking change could not be completed.');
            return;
        }
        setBlockActionError('');
        await fetchEngineState();
        setChallengeState((prev) => ({ ...prev, isOpen: false }));
    };

    const executeSourceRemoval = async (domain: string, source: string, sourceId?: string) => {
        const response = await new Promise<{ ok?: boolean; error?: string }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'REMOVE_BLOCK_SOURCE', domain, source, sourceId },
                (resp) => resolve(resp || { ok: false, error: chrome.runtime.lastError?.message }),
            ),
        );
        if (response.ok === false) {
            setBlockActionError(response.error || `Could not remove the ${source} block.`);
            return;
        }
        setBlockActionError('');
        setChallengeState((prev) => ({ ...prev, isOpen: false }));
        await fetchEngineState();
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
        const response = await new Promise<{ ok?: boolean; error?: string }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'CATEGORY_TOGGLE', category, enabled },
                (resp) => resolve(resp || { ok: false, error: chrome.runtime.lastError?.message }),
            ),
        );
        if (response.ok === false) {
            setBlockActionError(response.error || `Could not update ${SAFE_BLOCK_CATEGORY_LABELS[category]}.`);
        } else {
            setBlockActionError('');
            await fetchEngineState();
        }
        setCategoryPending(null);
    };

    return (
        <div className="space-y-6 animate-fade-in-up w-full">
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
            <div className="mb-2">
                <p className="focuz-section-label">Focus</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Site Management</h1>
                <p className="text-sm text-neutral-500 mt-1">Control what gets blocked and what stays reachable.</p>
            </div>
            {blockActionError && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>{blockActionError}</span>
                </div>
            )}

            <GlassCard className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="font-semibold text-white text-sm">Block by category</h3>
                        <p className="text-xs text-neutral-500 mt-1">
                            Turn on a curated group. Shared sites stay blocked until every matching category is removed.
                        </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
                        {SAFE_BLOCK_CATEGORY_KEYS.filter((key) => engineState.categoriesActive?.[key]).length} active
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {SAFE_BLOCK_CATEGORY_KEYS.map((category) => {
                        const active = !!engineState.categoriesActive?.[category];
                        const pending = categoryPending === category;
                        return (
                            <button
                                key={category}
                                type="button"
                                role="switch"
                                aria-checked={active}
                                disabled={categoryPending !== null || engineState.nuclearState?.active}
                                onClick={() => void toggleCategory(category)}
                                className={`flex min-h-20 items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    active
                                        ? 'border-purple-500/40 bg-purple-500/10'
                                        : 'border-white/[0.08] bg-[#111] hover:border-white/20'
                                }`}
                            >
                                <span>
                                    <span className={`block text-sm font-semibold ${active ? 'text-purple-200' : 'text-neutral-200'}`}>
                                        {SAFE_BLOCK_CATEGORY_LABELS[category]}
                                    </span>
                                    <span className="mt-1 block text-[10px] text-neutral-500">
                                        {SAFE_BLOCK_CATEGORIES[category].length} sites
                                    </span>
                                </span>
                                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${active ? 'bg-purple-500' : 'bg-neutral-700'}`}>
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                </span>
                                {pending && <span className="sr-only">Updating</span>}
                            </button>
                        );
                    })}
                </div>
                {engineState.nuclearState?.active && (
                    <p className="mt-3 text-xs text-amber-400/80">Categories cannot be changed during Nuclear Lockdown.</p>
                )}
            </GlassCard>

            {/* Platform quick-blocks */}
            <GlassCard className="p-5">
                <h3 className="font-semibold text-white text-sm mb-3">Platform Blockers</h3>
                <div className="flex flex-wrap gap-3">
                    {([
                        { label: 'YouTube Shorts', key: 'youtubeShorts', desc: 'Blocks /shorts URLs and feed' },
                        { label: 'YouTube', key: 'youtube', desc: 'Blocks all of YouTube' },
                        { label: 'Instagram Reels', key: 'instagramReels', desc: 'Blocks Reels feed' },
                        { label: 'TikTok', key: 'tiktok', desc: 'Blocks TikTok' },
                    ] as { label: string; key: keyof typeof engineState.inAppBlock; desc: string }[]).map(({ label, key, desc }) => {
                        const on = !!engineState.inAppBlock?.[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={async () => {
                                    await new Promise<void>(r => chrome.runtime.sendMessage({
                                        type: 'UPDATE_ENGINE_SETTINGS',
                                        settings: { inAppBlock: { ...engineState.inAppBlock, [key]: !on } }
                                    }, () => r()));
                                    fetchEngineState();
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-colors duration-150 ${on ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 hover:text-white'}`}
                                title={desc}
                            >
                                <span className={`w-2 h-2 rounded-full ${on ? 'bg-red-500' : 'bg-neutral-600'}`} />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-white text-base">Blocked List</h3>
                        <Ban size={18} className="text-red-400" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-4">
                        Supports subdomains (sub.site.com) and routes (site.com/path)
                    </p>
                    <div className="flex space-x-3 mb-6">
                        <input
                            value={newBlocked}
                            onChange={e => setNewBlocked(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { triggerAction('block', newBlocked, 'add'); setNewBlocked(''); } }}
                            placeholder="site.com or sub.site.com/path"
                            className="flex-1 min-w-0 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none transition-colors duration-150 text-white"
                        />
                        <button
                            onClick={() => { triggerAction('block', newBlocked, 'add'); setNewBlocked(''); }}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                        >Add</button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
                        {Object.entries(engineState.blocklist || {})
                            .filter(([, entry]) => entry.sources?.length > 0)
                            .map(([domain, entry]) => {
                                const sourceItems: { source: string; id?: string; label: string }[] = entry.sources.flatMap((source) => {
                                    if (source === 'category') {
                                        return (entry.categoryKeys || [])
                                            .filter((key): key is SafeBlockCategoryKey =>
                                                SAFE_BLOCK_CATEGORY_KEYS.includes(key as SafeBlockCategoryKey))
                                            .map((category) => ({
                                                source,
                                                id: category,
                                                label: SAFE_BLOCK_CATEGORY_LABELS[category],
                                            }));
                                    }
                                    if (source === 'timer') {
                                        const timers = engineState.timers?.[domain] || [];
                                        return timers.length
                                            ? timers.map((timer: { id: string; endTime: number }) => ({
                                                source,
                                                id: timer.id as string,
                                                label: `Timer · until ${new Date(timer.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                                            }))
                                            : [{ source, label: 'Timer' }];
                                    }
                                    if (source === 'schedule') {
                                        const schedules = engineState.schedules?.[domain] || [];
                                        return schedules.length
                                            ? schedules.map((schedule: { id: string; startHour: number; startMin: number; endHour: number; endMin: number }) => ({
                                                source,
                                                id: schedule.id as string,
                                                label: `Schedule · ${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMin).padStart(2, '0')}–${String(schedule.endHour).padStart(2, '0')}:${String(schedule.endMin).padStart(2, '0')}`,
                                            }))
                                            : [{ source, label: 'Schedule' }];
                                    }
                                    return [{
                                        source,
                                        label: source === 'manual' ? 'Manual' : source,
                                    }];
                                });

                                return (
                                    <div key={domain} className="p-4 bg-[#111] rounded-xl border border-white/5 hover:border-white/10 transition-colors duration-150">
                                        <span className="block text-sm font-medium text-white mb-2">{domain}</span>
                                        <div className="flex flex-wrap gap-2">
                                            {sourceItems.map((item, index) => (
                                                <span
                                                    key={`${item.source}-${item.id || index}`}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-1 pl-2.5 pr-1 text-[10px] font-semibold text-neutral-400"
                                                >
                                                    {item.label}
                                                    <button
                                                        type="button"
                                                        onClick={() => triggerSourceRemoval(domain, item.source, item.id)}
                                                        className="rounded-md p-1 text-neutral-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                        aria-label={`Remove ${item.label.toLowerCase()} block for ${domain}`}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        {Object.values(engineState.blocklist || {}).every((entry) => !entry.sources?.length) && (
                            <p className="py-8 text-center text-sm text-neutral-600">No sites are currently blocked.</p>
                        )}
                    </div>
                </GlassCard>

                <GlassCard className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white text-base">Allowed (Whitelist)</h3>
                        <Globe size={18} className="text-emerald-400" />
                    </div>
                    <div className="flex space-x-3 mb-6">
                        <input
                            value={newAllowed}
                            onChange={e => setNewAllowed(e.target.value)}
                            placeholder="trustedsite.com"
                            className="flex-1 min-w-0 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-colors duration-150 text-white"
                        />
                        <button
                            onClick={() => { triggerAction('allowed_site', newAllowed, 'add'); setNewAllowed(''); }}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                        >Add</button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
                        {(engineState.allowedSites || []).map((domain: string) => (
                            <div key={domain} className="flex items-center justify-between p-4 bg-[#111] rounded-xl border border-white/5 group hover:border-white/10 transition-colors duration-150">
                                <span className="text-sm font-medium text-white">{domain}</span>
                                <button
                                    type="button"
                                    onClick={() => triggerAction('allowed_site', domain, 'remove')}
                                    className="flex-shrink-0 p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-100 sm:opacity-60 sm:group-hover:opacity-100 relative z-10"
                                    aria-label={`Remove ${domain}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
            
            {/* Nuclear */}
            <GlassCard className="p-5 border-red-500/20 bg-red-900/5">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <Zap size={20} className="text-red-500" />
                    <h3 className="text-lg font-semibold text-white">Nuclear Lockdown</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">Irreversible</span>
                </div>
                
                {engineState.nuclearState?.active ? (
                    <div className="p-6 bg-red-600/15 border border-red-500/40 rounded-2xl text-center">
                        <span className="text-red-400 font-semibold text-sm">Nuclear lockdown active</span>
                        <div className="text-3xl font-semibold tabular-nums text-white mt-2">
                            {Math.max(0, Math.ceil((engineState.nuclearState.endTime - Date.now()) / 60000))}m remaining
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/60 mt-4">Un-cancellable by design</p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-neutral-400 mb-6 max-w-xl leading-relaxed">
                            Blocks every site on your blocklist for the chosen duration. Once activated, you cannot unblock sites until the timer expires.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {[15, 30, 60, 120].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setNuclearDuration(m)}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                                        nuclearDuration === m
                                            ? 'bg-white text-black'
                                            : 'bg-white/[0.06] text-neutral-300 hover:bg-white/10'
                                    }`}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <div className="flex items-center rounded-xl border border-white/10 bg-[#111] px-4 py-3 w-full sm:w-48 shrink-0">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mr-3">Custom</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={nuclearDuration}
                                    onChange={(e) => setNuclearDuration(parseInt(e.target.value, 10) || 1)}
                                    className="bg-transparent text-white font-semibold tabular-nums text-base outline-none w-full"
                                />
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 ml-1">min</span>
                            </div>
                            <button
                                type="button"
                                disabled={blocklistCount === 0}
                                onClick={() => setNukeModalOpen(true)}
                                className="flex-1 px-8 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 bg-red-500 text-white hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500"
                            >
                                Activate lockdown
                            </button>
                        </div>
                        {blocklistCount === 0 && (
                            <p className="text-xs text-amber-500/80 mt-3">Add sites to your blocklist first.</p>
                        )}
                    </>
                )}
            </GlassCard>

            <NuclearConfirmModal
                open={nukeModalOpen}
                durationMin={nuclearDuration}
                blocklistCount={blocklistCount}
                onClose={() => setNukeModalOpen(false)}
                onConfirm={async () => {
                    setNukeModalOpen(false);
                    const response = await chrome.runtime.sendMessage({
                        type: 'START_NUCLEAR',
                        target: 'blocked',
                        duration: nuclearDuration,
                    });
                    if (response?.ok === false) {
                        setBlockActionError(response.error || 'Nuclear Lockdown could not be started.');
                        return;
                    }
                    setBlockActionError('');
                    await fetchEngineState();
                }}
            />
        </div>
    );
};

export const StatisticsTab = () => {
    const { last7DaysStats } = useAuthStore();
    const [selectedSite, setSelectedSite] = useState<string | null>(null);
    const [hoveredDateIdx, setHoveredDateIdx] = useState<number | null>(null);
    const [tooltip, setTooltip] = useState<{ site: string; time: number; pct: number; x: number; y: number } | null>(null);
    const donutHostRef = useRef<HTMLDivElement>(null);
    const graphContainerRef = useRef<HTMLDivElement>(null);
    const [graphContainerWidth, setGraphContainerWidth] = useState(640);
    const [activityChartMode, setActivityChartMode] = useState<'bar' | 'line'>('line');

    useEffect(() => {
        const el = graphContainerRef.current;
        if (!el) return;
        const obs = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setGraphContainerWidth(entry.contentRect.width || 640);
            }
        });
        obs.observe(el);
        setGraphContainerWidth(el.clientWidth || 640);
        return () => obs.disconnect();
    }, []);

    const tooltipPosition = (clientX: number, clientY: number) => {
        const host = donutHostRef.current;
        if (!host) return { x: clientX, y: clientY };
        const rect = host.getBoundingClientRect();
        return { x: clientX - rect.left + 14, y: clientY - rect.top - 10 };
    };
    const allStats: any[] = last7DaysStats || [];
    const [windowEnd, setWindowEnd] = useState<number>(-1);

    const resolvedEnd = windowEnd === -1 ? Math.max(0, allStats.length - 1) : Math.min(windowEnd, allStats.length - 1);
    const resolvedStart = Math.max(0, resolvedEnd - 6);
    const chartData = allStats.slice(resolvedStart, resolvedEnd + 1);

    const canGoBack = resolvedStart > 0;
    const canGoForward = resolvedEnd < allStats.length - 1;

    const [selectedDateIdx, setSelectedDateIdx] = useState<number>(6);
    const selectedIdxClamped = Math.min(selectedDateIdx, Math.max(0, chartData.length - 1));

    useEffect(() => {
        setSelectedDateIdx(chartData.length - 1);
    }, [resolvedStart, resolvedEnd]);

    useEffect(() => {
        setSelectedSite(null);
        setTooltip(null);
    }, [selectedIdxClamped, resolvedEnd]);

    const maxTime = Math.max(...chartData.map((s: any) => s.total || 0), 1);

    const activeData = chartData[selectedIdxClamped] || { total: 0, sites: {}, date: new Date().toISOString() };
    const sitesArr = Object.entries(activeData.sites || {})
        .filter(([, time]) => (time as number) > 0)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 8);

    const formatTime = (ms: number) => {
        const capped = capDayScreenMs(ms || 0);
        const mins = Math.round(capped / 60000);
        if (mins < 60) return `${mins}m`;
        return `${Math.min(24, mins / 60).toFixed(1)}h`;
    };

    const colors = ['#a855f7', '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1'];

    const sitesTotalMs = sitesArr.reduce((sum, [, time]) => sum + (time as number), 0);
    const dayTotalMs = capDayScreenMs(Math.max(activeData.total || 0, sitesTotalMs));
    const totalMs = Math.max(dayTotalMs, 1);
    let cumPct = 0;
    const slices = sitesArr.map(([site, time]: any, i) => {
        const pct = (time as number) / totalMs;
        const startPct = cumPct * 100;
        cumPct += pct;
        const endPct = cumPct * 100;
        return {
            site,
            time: time as number,
            pct: Math.round(pct * 100),
            startPct,
            endPct,
            color: colors[i % colors.length],
        };
    });
    if (sitesArr.length > 0 && cumPct < 0.999) {
        const otherMs = totalMs - sitesTotalMs;
        slices.push({
            site: '__other__',
            time: otherMs,
            pct: Math.round((1 - cumPct) * 100),
            startPct: cumPct * 100,
            endPct: 100,
            color: 'rgba(255,255,255,0.12)',
        });
    }

    const graphWidth = Math.max(graphContainerWidth, 200);
    const graphHeight = 200;
    const padX = 28;
    const padTop = 20;
    const padBottom = 48;
    const plotW = graphWidth - padX * 2;
    const plotH = graphHeight - padTop - padBottom;
    const barGap = 10;
    const barW = Math.max(20, (plotW - barGap * (chartData.length - 1)) / Math.max(1, chartData.length));
    const getActivityPointX = (index: number) => padX + (index * plotW / Math.max(1, chartData.length - 1));
    const getActivityY = (total: number) => padTop + plotH - ((total || 0) / maxTime) * plotH;
    const activityLinePath = chartData.reduce((path: string, day, index: number) => {
        const x = getActivityPointX(index);
        const y = getActivityY(day.total);
        if (index === 0) return `M ${x} ${y}`;
        const previousX = getActivityPointX(index - 1);
        const previousY = getActivityY(chartData[index - 1].total);
        const controlX = (previousX + x) / 2;
        return `${path} C ${controlX} ${previousY}, ${controlX} ${y}, ${x} ${y}`;
    }, '');

    return (
        <div className="space-y-6 animate-fade-in-up w-full">
            <div>
                <p className="focuz-section-label">Insights</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Statistics & Analytics</h1>
                <p className="text-sm text-neutral-500 mt-1">Where your time went, day by day.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* BAR GRAPH */}
                <GlassCard className="p-5 flex flex-col bg-black/20" style={{ height: '420px' }}>
                    <div className="flex items-start justify-between gap-4 mb-1">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Screen time</p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <h3 className="font-semibold text-white text-sm">Weekly Activity</h3>
                                <span className="text-xs tabular-nums text-neutral-500">{formatTime(activeData.total)}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-neutral-500">Select a day to update the breakdown</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <div className="flex rounded-lg border border-white/[0.08] bg-black/30 p-0.5" role="group" aria-label="Weekly activity chart type">
                                {(['bar', 'line'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setActivityChartMode(mode)}
                                        aria-pressed={activityChartMode === mode}
                                        className={`rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors ${
                                            activityChartMode === mode ? 'bg-white/[0.12] text-white' : 'text-neutral-500 hover:text-neutral-300'
                                        }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.025] p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setWindowEnd(resolvedEnd - 7)}
                                    disabled={!canGoBack}
                                    aria-label="Previous week"
                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.07] disabled:opacity-20 disabled:cursor-not-allowed transition-colors duration-150 text-neutral-400 text-sm"
                                >‹</button>
                                <span className="h-4 w-px bg-white/[0.07]" />
                                <button
                                    type="button"
                                    onClick={() => setWindowEnd(Math.min(resolvedEnd + 7, allStats.length - 1))}
                                    disabled={!canGoForward}
                                    aria-label="Next week"
                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.07] disabled:opacity-20 disabled:cursor-not-allowed transition-colors duration-150 text-neutral-400 text-sm"
                                >›</button>
                            </div>
                        </div>
                    </div>

                    <div ref={graphContainerRef} className="flex-1 relative w-full mt-3 min-h-[260px]">
                        <svg
                            viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                            className="w-full h-full max-h-[280px]"
                            preserveAspectRatio="xMidYMid meet"
                        >
                            <defs>
                                <linearGradient id="weekly-activity-bar" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#e5e5e5" />
                                    <stop offset="100%" stopColor="#737373" />
                                </linearGradient>
                                <linearGradient id="weekly-activity-area" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#e5e5e5" stopOpacity="0.18" />
                                    <stop offset="100%" stopColor="#e5e5e5" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {[0, 0.25, 0.5, 0.75, 1].map(f => {
                                const y = padTop + plotH - f * plotH;
                                return (
                                    <g key={f}>
                                        <line
                                            x1={padX} y1={y}
                                            x2={graphWidth - padX} y2={y}
                                            stroke={f === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.055)'}
                                            strokeWidth="1"
                                            strokeDasharray={f === 0 ? undefined : '2 5'}
                                        />
                                        <text x={padX - 5} y={y + 3} textAnchor="end" fill="#525252" fontSize="9" fontWeight="500">
                                            {formatTime(maxTime * f)}
                                        </text>
                                    </g>
                                );
                            })}

                            {activityChartMode === 'line' && chartData.length > 0 && (
                                <>
                                    <motion.path
                                        d={`${activityLinePath} L ${getActivityPointX(chartData.length - 1)} ${padTop + plotH} L ${getActivityPointX(0)} ${padTop + plotH} Z`}
                                        fill="url(#weekly-activity-area)"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.4 }}
                                    />
                                    <motion.path
                                        d={activityLinePath}
                                        fill="none"
                                        stroke="#d4d4d4"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: 1 }}
                                        transition={{ duration: 0.6, ease: 'easeOut' }}
                                    />
                                </>
                            )}

                            {chartData.map((day: any, i: number) => {
                                const x = padX + i * (barW + barGap);
                                const h = Math.max(day.total > 0 ? 4 : 0, (day.total / maxTime) * plotH);
                                const y = padTop + plotH - h;
                                const pointX = getActivityPointX(i);
                                const pointY = getActivityY(day.total);
                                const sel = i === selectedIdxClamped;
                                const hovered = i === hoveredDateIdx;
                                return (
                                    <g
                                        key={day.date || i}
                                        onClick={() => setSelectedDateIdx(i)}
                                        onMouseEnter={() => setHoveredDateIdx(i)}
                                        onMouseLeave={() => setHoveredDateIdx(null)}
                                        onFocus={() => setHoveredDateIdx(i)}
                                        onBlur={() => setHoveredDateIdx(null)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                setSelectedDateIdx(i);
                                            }
                                        }}
                                        className="cursor-pointer outline-none"
                                        tabIndex={0}
                                        role="button"
                                        aria-pressed={sel}
                                        aria-label={`${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}: ${formatTime(day.total)}`}
                                    >
                                        <rect
                                            x={activityChartMode === 'bar' ? x : pointX - Math.max(20, plotW / Math.max(1, chartData.length) / 2)}
                                            y={padTop}
                                            width={activityChartMode === 'bar' ? barW : Math.max(40, plotW / Math.max(1, chartData.length))}
                                            height={plotH}
                                            fill="transparent"
                                        />
                                        {(hovered || sel) && (
                                            <rect
                                                x={(activityChartMode === 'bar' ? x : pointX - Math.max(20, plotW / Math.max(1, chartData.length) / 2)) - 3}
                                                y={padTop - 4}
                                                width={(activityChartMode === 'bar' ? barW : Math.max(40, plotW / Math.max(1, chartData.length))) + 6}
                                                height={plotH + 30}
                                                rx={8}
                                                fill="white"
                                                fillOpacity={sel ? 0.045 : 0.025}
                                            />
                                        )}
                                        {activityChartMode === 'bar' ? (
                                            <motion.rect
                                                x={x}
                                                width={barW}
                                                rx={Math.min(6, barW / 2)}
                                                fill={sel ? '#f5f5f5' : 'url(#weekly-activity-bar)'}
                                                opacity={sel ? 1 : hovered ? 0.88 : 0.58}
                                                initial={{ y: padTop + plotH, height: 0 }}
                                                animate={{ y, height: h }}
                                                transition={{ duration: 0.48, delay: i * 0.045, ease: 'easeOut' }}
                                            />
                                        ) : (
                                            <circle
                                                cx={pointX}
                                                cy={pointY}
                                                r={sel || hovered ? 5 : 3.5}
                                                fill="#0a0a0a"
                                                stroke={sel ? '#fff' : '#a3a3a3'}
                                                strokeWidth="2"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}
                                        {day.total > 0 && (
                                            <text
                                                x={activityChartMode === 'bar' ? x + barW / 2 : pointX}
                                                y={Math.max(12, (activityChartMode === 'bar' ? y : pointY) - 6)}
                                                textAnchor="middle"
                                                fill={sel ? '#fff' : hovered ? '#d4d4d4' : '#737373'}
                                                fontSize="10"
                                                fontWeight="600"
                                                opacity={activityChartMode === 'bar' || sel || hovered ? 1 : 0}
                                                className="transition-opacity duration-150"
                                            >
                                                {formatTime(day.total)}
                                            </text>
                                        )}
                                        <text
                                            x={activityChartMode === 'bar' ? x + barW / 2 : pointX} y={graphHeight - padBottom + 22}
                                            textAnchor="middle"
                                            fill={sel ? '#f5f5f5' : hovered ? '#a3a3a3' : '#525252'}
                                            fontSize="11"
                                            fontWeight={sel ? '650' : '500'}
                                        >
                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </GlassCard>

                {/* HALF PIE CHART */}
                <GlassCard className="p-5 flex flex-col relative" style={{ minHeight: '420px' }}>
                    <div className="mb-2">
                        <h3 className="font-semibold text-white text-sm">Date Breakdown</h3>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                            {new Date(activeData.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                    </div>

                    <div className="relative flex flex-col items-center w-full pt-1 pb-1">
                        <div
                            ref={donutHostRef}
                            className="relative shrink-0"
                            style={{ width: semiDonutMetrics.vbW, height: semiDonutMetrics.vbH }}
                        >
                        <SemiDonutChart
                            className="w-full flex justify-center"
                            slices={slices}
                            totalLabel={formatTime(dayTotalMs)}
                            onSliceClick={setSelectedSite}
                            onSliceHover={(slice, clientX, clientY) => {
                                if (!slice) {
                                    setTooltip(null);
                                    return;
                                }
                                const pos = tooltipPosition(clientX, clientY);
                                setSelectedSite(slice.site);
                                setTooltip({
                                    site: slice.site,
                                    time: slice.time,
                                    pct: slice.pct,
                                    x: pos.x,
                                    y: pos.y,
                                });
                            }}
                        />
                        {tooltip && (
                            <div
                                className="absolute z-20 glass-edge-card p-3 shadow-xl pointer-events-none min-w-[180px]"
                                style={{
                                    left: tooltip.x,
                                    top: tooltip.y,
                                    transform: 'translateY(-100%)',
                                }}
                            >
                                <div className="flex items-center space-x-2 mb-2">
                                    <img src={`https://s2.googleusercontent.com/s2/favicons?domain=${tooltip.site}&sz=32`} className="w-5 h-5 rounded" alt="" />
                                    <span className="text-white font-semibold text-xs truncate max-w-[110px]">{tooltip.site}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-400 text-xs">{formatTime(tooltip.time)}</span>
                                    <span className="text-purple-400 font-semibold tabular-nums text-sm">{tooltip.pct}%</span>
                                </div>
                            </div>
                        )}
                        </div>
                        {slices.length === 0 && (
                            <p className="text-neutral-500 text-xs font-semibold mt-2">No usage this day</p>
                        )}
                    </div>

                    <div className="mt-3 border-t border-white/5 pt-3 mb-2">
                        {selectedSite ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <img src={`https://s2.googleusercontent.com/s2/favicons?domain=${selectedSite}&sz=64`} alt="" className="w-10 h-10 rounded-lg bg-white/5 p-1 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-base font-semibold text-white truncate">{selectedSite}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Selected</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                    <span className="text-2xl font-semibold tabular-nums text-purple-400">
                                        {slices.find((s) => s.site === selectedSite)?.pct ?? 0}%
                                    </span>
                                    <span className="text-xs text-neutral-500">
                                        {formatTime(slices.find((s) => s.site === selectedSite)?.time ?? 0)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-neutral-600 text-xs py-2">Hover or click a slice for details</p>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="space-y-1.5 overflow-y-auto flex-1" style={{ maxHeight: '220px' }}>
                        {slices.length === 0 ? (
                            <p className="text-neutral-600 text-xs text-center py-4">No data for this day.</p>
                        ) : slices.filter((s) => s.site !== '__other__').map((slice, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedSite === slice.site ? 'bg-white/8 ring-1 ring-purple-500/20' : 'hover:bg-white/[0.03]'}`}
                                onClick={() => setSelectedSite(slice.site)}
                            >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: slice.color }} />
                                    <img src={`https://s2.googleusercontent.com/s2/favicons?domain=${slice.site}&sz=32`} className="w-5 h-5 rounded flex-shrink-0" alt="" />
                                    <span className="text-xs text-white truncate">{slice.site}</span>
                                </div>
                                <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${slice.pct}%`, background: slice.color }} />
                                    </div>
                                    <span className="text-[10px] text-neutral-500 tabular-nums w-10 text-right">{formatTime(slice.time)}</span>
                                    <span className="text-[10px] font-semibold text-purple-400 tabular-nums w-7 text-right">{slice.pct}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};


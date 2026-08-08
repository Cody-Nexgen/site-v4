import { useAuthStore } from '../lib/store';
import { useMemo, useState, useEffect } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProDashboardVisuals } from '../lib/proDashboard';
import { capDayScreenMs } from '../lib/screenTimeCap';
import { ProDashboardHero } from '../components/pro-dashboard/ProDashboardVisuals';
import { HabitDayCell } from '../components/pro-dashboard/HabitCheckInButton';
import HabitNameModal from '../components/HabitNameModal';
import { computeFocusScore, focusScoreColor } from '../lib/focusScore';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { FocusLevelCard } from '../components/FocusLevelCard';
import { ActivityGraph } from './OptionsApp';
import { computeHabitStreak } from '../lib/habitStreak';

export default function OverviewTab() {
    const { streak, engineState, last7DaysStats, fetchEngineState, offsetWeeks, setOffsetWeeks, dashboardStreak, importHistory } = useAuthStore();
    const { proGoldTheme, enabled: proVisuals } = useProDashboardVisuals();
    const { progression } = useFocusProgression();

    useEffect(() => {
        void importHistory();
    }, [importHistory]);

    const statsLen = last7DaysStats?.length || 0;
    const endIdx = statsLen - 1 - offsetWeeks * 7;
    const todayDateStr = endIdx >= 0 ? last7DaysStats[endIdx]?.date : new Date().toDateString();
    const yesterdayDateStr = endIdx > 0 ? last7DaysStats[endIdx - 1]?.date : undefined;
    const todayTotal = capDayScreenMs(endIdx >= 0 ? (last7DaysStats[endIdx]?.total || 0) : 0, { date: todayDateStr });
    const yesterdayTotal = capDayScreenMs(endIdx > 0 ? (last7DaysStats[endIdx - 1]?.total || 0) : 0, { date: yesterdayDateStr });
    const blockedCount = engineState.blockedToday || 0;

    const diff = todayTotal - yesterdayTotal;
    const diffPercent = yesterdayTotal === 0 ? 0 : Math.round((Math.abs(diff) / yesterdayTotal) * 100);
    const isUp = diff > 0;

    const formatTime = (ms: number, dateStr?: string) => {
        const capped = capDayScreenMs(ms, { date: dateStr });
        const mins = Math.round(capped / 60000);
        if (mins < 60) return `${mins}m`;
        return `${Math.min(24, mins / 60).toFixed(1)}h`;
    };

    const planner = engineState.dailyPlanner || [];
    const habits = engineState.habits || [];
    const today = new Date();

    const last7DaysStrings = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i) - offsetWeeks * 7);
            return d.toDateString();
        });
    }, [offsetWeeks]);

    const [newTaskName, setNewTaskName] = useState('');
    const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
    const [habitModalOpen, setHabitModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<typeof last7DaysStats[0] | null>(null);

    const addHabitByName = async (name: string) => {
        const updated = [...habits, { id: Date.now(), name, streak: 0, checkins: [], lastCheckin: '' }];
        await new Promise<void>(r =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } },
                () => r(),
            ),
        );
        await fetchEngineState();
        useAuthStore.getState().recalculateStreak();
    };

    const checkInHabit = async (id: number, dateStr: string) => {
        const todayString = new Date().toDateString();
        if (dateStr !== todayString) return;
        const habit = habits.find((h: { id: number }) => h.id === id);
        if (!habit || habit.checkins?.includes(dateStr)) return;
        const updated = habits.map((h: { id: number; checkins?: string[]; streak?: number }) => {
            if (h.id !== id) return h;
            const checkins = [...(h.checkins || []), dateStr];
            return { ...h, checkins, streak: computeHabitStreak(checkins) };
        });
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
        await fetchEngineState();
        await sendProgressionMessage({ type: 'PROGRESSION_HABIT_CHECKIN', habitId: id });
        useAuthStore.getState().recalculateStreak();
    };

    const addPlanItem = async () => {
        if (!newTaskName.trim()) return;
        const updated = [...planner, { id: Date.now(), time: 'Anytime', task: newTaskName.trim(), done: false }];
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        setNewTaskName('');
        fetchEngineState();
    };

    const togglePlanItem = async (id: number) => {
        const updated = planner.map((p: { id: number; done: boolean }) => (p.id === id ? { ...p, done: !p.done } : p));
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    const deletePlanItem = async (id: number) => {
        if (deletingTaskId !== null) return;
        setDeletingTaskId(id);
        try {
            const updated = planner.filter((p: { id: number }) => p.id !== id);
            await new Promise<void>(r =>
                chrome.runtime.sendMessage(
                    { type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } },
                    () => r(),
                ),
            );
            await fetchEngineState();
        } finally {
            setDeletingTaskId(null);
        }
    };

    const todaySites = endIdx >= 0 ? (last7DaysStats[endIdx]?.sites ?? {}) : {};
    const todayStr = today.toDateString();
    const pomodoroToday =
        engineState.pomodoroSettings?.lastDate === todayStr
            ? engineState.pomodoroSettings?.sessionsCompleted ?? 0
            : 0;

    const weekStats = useMemo(() => {
        const end = statsLen - offsetWeeks * 7;
        const start = Math.max(0, end - 7);
        if (end <= 0) return [];
        return last7DaysStats.slice(start, end);
    }, [last7DaysStats, statsLen, offsetWeeks]);

    const canGoOlder = statsLen - (offsetWeeks + 1) * 7 > 0;

    const weekRangeLabel = useMemo(() => {
        if (offsetWeeks === 0) return 'This week';
        if (offsetWeeks === 1) return 'Last week';
        return `${offsetWeeks} weeks ago`;
    }, [offsetWeeks]);

    const focusResult = useMemo(
        () =>
            computeFocusScore({
                todaySites,
                todayTotalMs: todayTotal,
                blockedToday: blockedCount,
                dailyPlanner: planner,
                habits,
                pomodoroSessionsToday: pomodoroToday,
                streak: dashboardStreak,
            }),
        [todaySites, todayTotal, blockedCount, planner, habits, pomodoroToday, dashboardStreak],
    );

    const doneTasks = planner.filter((p: { done: boolean }) => p.done).length;

    return (
        <div className="relative space-y-10 pt-6 animate-fade-in-up pro-page-enter pb-24 font-sans w-full max-w-5xl mx-auto">
            {proGoldTheme && proVisuals && <ProDashboardHero streak={streak} blockedToday={blockedCount} />}
            {progression && <FocusLevelCard progression={progression} compact />}

            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-neutral-500 tracking-wide mb-2">
                        {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">Dashboard</h1>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                    <span className="inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                    Live sync
                </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Focuz score', value: String(focusResult.score), accent: focusScoreColor(focusResult.score) },
                    { label: 'Screen time', value: formatTime(todayTotal), accent: '#fff' },
                    { label: 'Blocked', value: String(blockedCount), accent: '#f87171' },
                    { label: 'Streak', value: `${dashboardStreak}d`, accent: '#c4b5fd' },
                ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] px-5 py-5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{stat.label}</p>
                        <p className="text-2xl font-semibold mt-2 tabular-nums" style={{ color: stat.accent }}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-base">
                        🍅
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-white">Pomodoro</p>
                        <p className="text-[11px] text-neutral-500">
                            {pomodoroToday} session{pomodoroToday === 1 ? '' : 's'} completed today
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('focuznow-navigate-tab', { detail: 'sessions' }))}
                    className="text-[11px] font-medium text-purple-300 hover:text-purple-200 transition-colors shrink-0"
                >
                    Open →
                </button>
            </div>

            <section className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] overflow-hidden">
                <div className="px-6 pt-6 pb-3 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Weekly activity</h2>
                        <p className="text-[11px] text-neutral-500 mt-1">
                            {isUp ? '↑' : '↓'} {diffPercent}% vs yesterday
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-neutral-500">{weekRangeLabel}</span>
                        <button
                            type="button"
                            disabled={!canGoOlder}
                            onClick={() => setOffsetWeeks(offsetWeeks + 1)}
                            className="w-7 h-7 rounded-lg text-neutral-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            aria-label="Older week"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            disabled={offsetWeeks === 0}
                            onClick={() => setOffsetWeeks(Math.max(0, offsetWeeks - 1))}
                            className="w-7 h-7 rounded-lg text-neutral-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            aria-label="Newer week"
                        >
                            ›
                        </button>
                    </div>
                </div>
                <div className="px-2 pb-4 h-56 sm:h-64 md:h-72">
                    <ActivityGraph stats={weekStats} onSelectDay={setSelectedDay} />
                </div>
                <div className="px-5 pb-4 flex justify-between text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">
                    {weekStats.map((s, i) => (
                        <span key={i}>{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-5 flex flex-col min-h-[320px]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Tasks</h2>
                            <p className="text-[11px] text-neutral-500">{doneTasks}/{planner.length} complete</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addPlanItem()}
                            placeholder="Add a task"
                            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 placeholder:text-neutral-600"
                        />
                        <button type="button" onClick={addPlanItem} className="px-4 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200">
                            Add
                        </button>
                    </div>
                    <div className="flex-1 space-y-1 overflow-y-auto">
                        {planner.length === 0 && (
                            <p className="text-neutral-600 text-sm py-8 text-center">Nothing scheduled yet.</p>
                        )}
                        {planner.map((p: { id: number; task: string; done: boolean }) => (
                            <div
                                key={p.id}
                                className="group flex w-full items-center rounded-xl transition-colors hover:bg-white/[0.03] focus-within:bg-white/[0.03]"
                            >
                                <button
                                    type="button"
                                    onClick={() => togglePlanItem(p.id)}
                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
                                    aria-label={`${p.done ? 'Mark incomplete' : 'Mark complete'}: ${p.task}`}
                                    aria-pressed={p.done}
                                >
                                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${p.done ? 'bg-white border-white' : 'border-white/20'}`}>
                                        {p.done && <Check size={12} className="text-black" />}
                                    </span>
                                    <span className={`text-sm truncate ${p.done ? 'line-through text-neutral-600' : 'text-neutral-200'}`}>{p.task}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void deletePlanItem(p.id);
                                    }}
                                    disabled={deletingTaskId !== null}
                                    className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-wait disabled:opacity-40 group-hover:opacity-100"
                                    aria-label={`Delete task: ${p.task}`}
                                    title={`Delete ${p.task}`}
                                >
                                    <Trash2 size={15} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Habits</h2>
                            <p className="text-[11px] text-neutral-500">{habits.length} active</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setOffsetWeeks(offsetWeeks + 1)} className="w-8 h-8 rounded-lg text-neutral-500 hover:bg-white/5">‹</button>
                            <button type="button" disabled={offsetWeeks === 0} onClick={() => setOffsetWeeks(Math.max(0, offsetWeeks - 1))} className="w-8 h-8 rounded-lg text-neutral-500 hover:bg-white/5 disabled:opacity-30">›</button>
                            <button type="button" onClick={() => setHabitModalOpen(true)} className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center ml-1">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    {habits.length === 0 ? (
                        <p className="text-neutral-600 text-sm py-12 text-center">Add a habit to track consistency.</p>
                    ) : (
                        <div className="space-y-3">
                            {habits.slice(0, 5).map((h: { id: number; name: string; streak?: number; checkins?: string[] }) => (
                                <div key={h.id} className="rounded-xl border border-white/[0.05] px-3 py-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-white">{h.name}</span>
                                        <span className="text-xs font-semibold text-neutral-400">
                                            {computeHabitStreak(h.checkins || [])}d
                                        </span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {last7DaysStrings.map((ds, i) => (
                                            <HabitDayCell
                                                key={i}
                                                checked={!!h.checkins?.includes(ds)}
                                                isToday={ds === today.toDateString()}
                                                disabled={ds !== today.toDateString()}
                                                title={ds}
                                                onCheckIn={() => checkInHabit(h.id, ds)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {selectedDay && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-40 flex items-start justify-center rounded-2xl bg-black/60 backdrop-blur-md p-4 pt-12 overflow-y-auto"
                    onClick={() => setSelectedDay(null)}
                >
                    <motion.div
                        initial={{ scale: 0.97, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111114] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                                    {new Date(selectedDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                                <p className="text-3xl font-semibold text-white mt-1 tabular-nums">{formatTime(selectedDay.total)}</p>
                                <p className="text-[11px] text-neutral-500 mt-0.5">total screen time</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDay(null)}
                                className="w-8 h-8 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors text-lg leading-none"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="px-3 py-3 max-h-72 overflow-y-auto">
                            {Object.entries(selectedDay.sites ?? {})
                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                .slice(0, 12)
                                .map(([site, ms]) => (
                                    <div key={site} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                                        <img
                                            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=32`}
                                            alt=""
                                            className="w-5 h-5 rounded shrink-0"
                                            loading="lazy"
                                        />
                                        <span className="text-sm text-neutral-200 truncate flex-1">{site}</span>
                                        <span className="text-xs font-semibold text-neutral-400 tabular-nums shrink-0">{formatTime(ms as number)}</span>
                                    </div>
                                ))}
                            {Object.keys(selectedDay.sites ?? {}).length === 0 && (
                                <p className="text-sm text-neutral-600 text-center py-8">No sites recorded that day.</p>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}

            <HabitNameModal open={habitModalOpen} onClose={() => setHabitModalOpen(false)} onSubmit={addHabitByName} />
        </div>
    );
}

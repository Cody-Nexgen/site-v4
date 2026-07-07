import { useAuthStore } from '../lib/store';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useProDashboardVisuals } from '../lib/proDashboard';
import { capDayScreenMs } from '../lib/screenTimeCap';
import { ProDashboardHero } from '../components/pro-dashboard/ProDashboardVisuals';
import { HabitDayCell } from '../components/pro-dashboard/HabitCheckInButton';
import HabitNameModal from '../components/HabitNameModal';
import { computeFocusScore, focusScoreColor } from '../lib/focusScore';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { FocusLevelCard } from '../components/FocusLevelCard';

export default function OverviewTab() {
    const { streak, engineState, last7DaysStats, fetchEngineState, offsetWeeks, setOffsetWeeks, dashboardStreak } = useAuthStore();
    const { proGoldTheme, enabled: proVisuals } = useProDashboardVisuals();
    const { progression } = useFocusProgression();

    const statsLen = last7DaysStats?.length || 0;
    const endIdx = statsLen - 1 - offsetWeeks * 7;
    const todayTotal = capDayScreenMs(endIdx >= 0 ? (last7DaysStats[endIdx]?.total || 0) : 0);
    const yesterdayTotal = capDayScreenMs(endIdx > 0 ? (last7DaysStats[endIdx - 1]?.total || 0) : 0);
    const blockedCount = engineState.blockedToday || 0;

    const diff = todayTotal - yesterdayTotal;
    const diffPercent = yesterdayTotal === 0 ? 0 : Math.round((Math.abs(diff) / yesterdayTotal) * 100);
    const isUp = diff > 0;
    const trendColor = isUp ? 'text-red-400' : 'text-green-400';
    const trendArrow = isUp ? '↑' : '↓';

    const formatTime = (ms: number) => {
        const capped = capDayScreenMs(ms);
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
    const [selectedTab, setSelectedTab] = useState('All');

    const [habitModalOpen, setHabitModalOpen] = useState(false);

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
        const habit = habits.find((h: any) => h.id === id);
        if (!habit || habit.checkins?.includes(dateStr)) return;
        
        const updated = habits.map((h: any) => {
            if (h.id !== id) return h;
            return { ...h, checkins: [...(h.checkins || []), dateStr], streak: (h.streak || 0) + 1 };
        });
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
        await fetchEngineState();
        await sendProgressionMessage({ type: 'PROGRESSION_HABIT_CHECKIN', habitId: id });
        useAuthStore.getState().recalculateStreak();
    };

    const showFocus = selectedTab === 'All' || selectedTab === 'Focus';
    const showTasks = selectedTab === 'All' || selectedTab === 'Tasks';
    const showHabits = selectedTab === 'All' || selectedTab === 'Habits';
    const showBlocks = selectedTab === 'All' || selectedTab === 'Blocks';

    const addPlanItem = async () => {
        if (!newTaskName.trim()) return;
        const updated = [...planner, { id: Date.now(), time: 'Anytime', task: newTaskName.trim(), done: false }];
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        setNewTaskName('');
        fetchEngineState();
    };

    const togglePlanItem = async (id: number) => {
        const updated = planner.map((p: any) => (p.id === id ? { ...p, done: !p.done } : p));
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    const removePlanItem = async (id: number) => {
        const updated = planner.filter((p: any) => p.id !== id);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    const weeklyAvgMs = useMemo(() => {
        if (!last7DaysStats?.length) return 0;
        const slice = last7DaysStats.slice(Math.max(0, last7DaysStats.length - 7));
        return slice.reduce((acc, d) => acc + capDayScreenMs(d.total || 0), 0) / slice.length;
    }, [last7DaysStats]);

    const todaySites = endIdx >= 0 ? (last7DaysStats[endIdx]?.sites ?? {}) : {};
    const todayStr = today.toDateString();
    const pomodoroToday =
        engineState.pomodoroSettings?.lastDate === todayStr
            ? engineState.pomodoroSettings?.sessionsCompleted ?? 0
            : 0;

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

    return (
        <div className="space-y-8 pt-6 animate-fade-in-up pro-page-enter pb-20 font-sans w-full">
            {proGoldTheme && proVisuals && <ProDashboardHero streak={streak} blockedToday={blockedCount} />}
            {progression && (
                <FocusLevelCard progression={progression} compact />
            )}
            {/* Header */}
            <div className="flex items-end justify-between mb-8">
                <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                        {today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                    </p>
                    <h1 className="text-5xl font-black text-white tracking-tighter flex items-center gap-3">
                        Today
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]" title="Live" />
                    </h1>
                </div>
                <div className="flex items-center space-x-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                    {['All', 'Focus', 'Tasks', 'Habits', 'Blocks'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setSelectedTab(tab)}
                            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${selectedTab === tab ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Creative bento — bottom workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
                {showFocus && (
                    <div className="lg:col-span-4 rounded-[28px] border border-purple-500/15 bg-gradient-to-br from-purple-950/40 via-[#0c0c0e] to-[#0a0a0a] p-6 relative overflow-hidden">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl" />
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Focus pulse</p>
                        <div className="flex items-end gap-3">
                            <span className="text-6xl font-black leading-none" style={{ color: focusScoreColor(focusResult.score) }}>
                                {focusResult.score}
                            </span>
                            <span className="text-sm text-neutral-500 pb-2">{focusResult.label}</span>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-600 to-amber-400 rounded-full transition-all" style={{ width: `${focusResult.score}%` }} />
                        </div>
                        <p className="text-xs text-neutral-500 mt-3">{blockedCount} blocks · {pomodoroToday} pomodoros today</p>
                    </div>
                )}

                {showTasks && (
                    <div className="lg:col-span-5 rounded-[28px] border border-white/8 bg-[#0c0c0e] p-6 flex flex-col min-h-[280px]">
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Today&apos;s flow</p>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newTaskName}
                                onChange={(e) => setNewTaskName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addPlanItem()}
                                placeholder="Add a task…"
                                className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/40"
                            />
                            <button onClick={addPlanItem} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white">Add</button>
                        </div>
                        <div className="flex-1 space-y-1 overflow-y-auto max-h-48">
                            {planner.length === 0 && <p className="text-neutral-600 text-sm italic">Clear slate — what matters today?</p>}
                            {planner.slice(0, 8).map((p: any) => (
                                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] group">
                                    <button onClick={() => togglePlanItem(p.id)} className={`w-5 h-5 rounded-md border flex-shrink-0 ${p.done ? 'bg-purple-500 border-purple-500' : 'border-white/15'}`}>
                                        {p.done && <span className="text-white text-xs">✓</span>}
                                    </button>
                                    <span className={`text-sm font-medium flex-1 truncate ${p.done ? 'line-through text-neutral-600' : 'text-white'}`}>{p.task}</span>
                                    <button onClick={() => removePlanItem(p.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 text-lg">×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(showFocus || showBlocks) && (
                    <div className="lg:col-span-3 rounded-[28px] border border-amber-500/10 bg-gradient-to-b from-amber-950/20 to-[#0c0c0e] p-6 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest">Screen time</p>
                            <p className="text-4xl font-black text-white mt-2">{formatTime(todayTotal)}</p>
                            {yesterdayTotal > 0 && (
                                <p className={`text-xs font-bold mt-1 ${trendColor}`}>{trendArrow} {diffPercent}% vs yesterday</p>
                            )}
                            <p className="text-[10px] text-neutral-600 mt-2">Weekly avg {formatTime(weeklyAvgMs)}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Streak</p>
                            <p className="text-2xl font-black text-purple-300">{streak} <span className="text-sm font-bold text-neutral-500">days</span></p>
                        </div>
                    </div>
                )}

                {showHabits && (
                    <div className="lg:col-span-12 rounded-[28px] border border-white/8 bg-[#0c0c0e] p-6 md:p-8">
                        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                            <div>
                                <h3 className="text-xl font-black text-white">Habit constellation</h3>
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">{habits.length} rituals</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setOffsetWeeks(offsetWeeks + 1)} className="glass-edge-btn w-8 h-8 text-neutral-400">‹</button>
                                <button type="button" disabled={offsetWeeks === 0} onClick={() => setOffsetWeeks(Math.max(0, offsetWeeks - 1))} className="glass-edge-btn w-8 h-8 text-neutral-400 disabled:opacity-30">›</button>
                                <button type="button" onClick={() => setHabitModalOpen(true)} className="glass-edge-btn w-9 h-9 bg-purple-600 text-white rounded-xl"><Plus size={18} /></button>
                            </div>
                        </div>
                        {habits.length === 0 ? (
                            <p className="text-neutral-600 text-sm">Add a habit to start your constellation.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {habits.slice(0, 6).map((h: any) => {
                                    const weekDone = last7DaysStrings.filter((ds) => h.checkins?.includes(ds)).length;
                                    return (
                                        <div key={h.id} className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 hover:border-purple-500/20 transition-colors">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-bold text-white text-sm">{h.name}</span>
                                                <span className="text-lg font-black text-purple-400">{h.streak || 0}d</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                                {last7DaysStrings.map((ds, i) => {
                                                    const checked = h.checkins?.includes(ds);
                                                    const isToday = ds === today.toDateString();
                                                    return (
                                                        <HabitDayCell key={i} checked={!!checked} isToday={isToday} title={ds} onCheckIn={() => checkInHabit(h.id, ds)} />
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-neutral-600 mt-2">{weekDone}/7 this week</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {showBlocks && selectedTab === 'Blocks' && (
                    <div className="lg:col-span-12 rounded-[28px] border border-red-500/15 bg-red-950/10 p-8 text-center">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Distractions stopped</p>
                        <p className="text-6xl font-black text-white mt-2">{blockedCount}</p>
                    </div>
                )}
            </div>

            <HabitNameModal
                open={habitModalOpen}
                onClose={() => setHabitModalOpen(false)}
                onSubmit={addHabitByName}
            />
        </div>
    );
}

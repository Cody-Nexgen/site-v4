import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import { dispatchFocusComplete } from '../lib/proDashboard';
import {
    POMODORO_RUNTIME_KEY,
    computeTimeLeft,
    readPomodoroRuntime,
    writePomodoroRuntime,
    type PomodoroRuntime,
} from '../lib/pomodoroRuntime';
import { GlassCard } from './OptionsApp';
import CalendarView from './CalendarView';
import { 
    Play, Pause, RefreshCw, Plus,
    Trash, Check, Ban, Globe, Zap, Maximize2, Pencil, Minimize2, X,
    AlertTriangle, TrendingDown, Lightbulb,
} from 'lucide-react';
import { HabitCheckInButton } from '../components/pro-dashboard/HabitCheckInButton';
import { IconCalendarStats } from '@tabler/icons-react';
import { SemiDonutChart, semiDonutMetrics } from '../lib/semiDonutChart';
import { capDayScreenMs } from '../lib/screenTimeCap';
import { ChallengeModal, randomFocusPhrase } from '../lib/unblockChallenge';
import { sendProgressionMessage } from '../hooks/useFocusProgression';
import HabitNameModal from '../components/HabitNameModal';
import DeepWorkPlanner from '../components/DeepWorkPlanner';
import { FocusActivityChart } from '../components/FocusActivityChart';
import { detectProcrastinationPatterns } from '../lib/procrastinationPatterns';
import { detectOverridePatterns, type EmergencyOverrideEntry } from '../lib/emergencyOverride';
import { computeFocusScore, focusScoreColor, computeAllTimeFocusScore } from '../lib/focusScore';
import { NuclearConfirmModal } from '../components/NuclearConfirmModal';

export const InboxTab = () => (
    <div className="space-y-6 animate-fade-in-up max-w-[1200px] mx-auto">
        <h2 className="text-2xl font-bold text-white">Inbox</h2>
        <GlassCard className="p-8 flex flex-col items-center justify-center h-64 text-center">
            <span className="text-neutral-500 text-sm font-bold uppercase tracking-widest mb-2">Empty Inbox</span>
            <span className="text-neutral-400">All captured thoughts and incoming integrations will appear here.</span>
        </GlassCard>
    </div>
);

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
    const maxFocus = Math.max(...recentWeek.map((d) => computeFocusScore({ todaySites: d.sites, todayTotalMs: d.total }).score), 1);
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
                <h2 className="text-2xl font-bold text-white">Patterns</h2>
                <p className="text-sm text-neutral-500 mt-1">Activity trends and focus insights — all computed locally.</p>
            </div>

            {/* Activity heatmap */}
            <GlassCard className="p-6">
                <h3 className="font-bold text-white text-sm mb-1">Focus activity</h3>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-4">Last 12 weeks · darker green = higher focus score</p>
                <FocusActivityChart stats={allStats} weeks={12} />
            </GlassCard>

            {/* Weekly stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <GlassCard className="p-5">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Today&apos;s score</span>
                    <p className="text-3xl font-black mt-1" style={{ color: focusScoreColor(focusResult.score) }}>{focusResult.score}</p>
                    <p className="text-xs text-neutral-500">{focusResult.label}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">All-time score</span>
                    <p className="text-3xl font-black mt-1" style={{ color: focusScoreColor(allTime.score) }}>{allTime.score}</p>
                    <p className="text-xs text-neutral-500">{allTime.daysCounted > 0 ? `Avg · ${allTime.daysCounted} days` : 'No data yet'}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Usage today</span>
                    <p className="text-3xl font-black text-white mt-1">{formatTime(todayData?.total ?? 0)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Blocks today</span>
                    <p className="text-3xl font-black text-white mt-1">{engineState.blockedToday ?? 0}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Activity streak</span>
                    <p className="text-3xl font-black text-purple-400 mt-1">{streak}<span className="text-sm text-neutral-500 ml-1">d</span></p>
                </GlassCard>
            </div>

            {/* Weekly focus score bars */}
            <GlassCard className="p-6">
                <h3 className="font-bold text-white text-sm mb-4">Weekly focus scores</h3>
                <div className="flex items-end gap-2 h-32">
                    {recentWeek.map((day) => {
                        const score = computeFocusScore({ todaySites: day.sites, todayTotalMs: day.total }).score;
                        const h = Math.max(8, (score / maxFocus) * 100);
                        const label = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                        return (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                                <span className="text-[9px] text-neutral-500 font-bold">{score}</span>
                                <div
                                    className="w-full rounded-t-md transition-all"
                                    style={{ height: `${h}%`, backgroundColor: focusScoreColor(score), opacity: 0.85 }}
                                    title={`${day.date}: ${score}`}
                                />
                                <span className="text-[9px] text-neutral-600 truncate w-full text-center">{label}</span>
                            </div>
                        );
                    })}
                </div>
            </GlassCard>

            {/* AI Patterns section */}
            <div>
                <h3 className="text-lg font-bold text-white mb-2">AI patterns</h3>
                <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                    Procrastination and distraction patterns detected from your local browsing data.
                </p>
                {patterns.length === 0 ? (
                    <GlassCard className="p-8 flex flex-col items-center justify-center text-center">
                        <Lightbulb size={32} className="text-purple-400 mb-3" />
                        <p className="text-white font-bold mb-2">No AI patterns yet</p>
                        <p className="text-neutral-400 text-sm leading-relaxed max-w-sm">
                            Keep using FocuzNow for a few days and insights will appear here.
                        </p>
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
                                            <h4 className="font-bold text-white">{p.title}</h4>
                                            <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded bg-white/5 text-neutral-400">
                                                {p.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-400 mb-3 leading-relaxed">{p.detail}</p>
                                        <p className="text-sm text-purple-300/90 leading-relaxed">
                                            <span className="font-bold text-purple-400 block mb-1">Try this</span>
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
                    <h3 className="text-lg font-bold text-white mb-2">Emergency override patterns</h3>
                    <p className="text-sm text-neutral-500 mb-4">
                        Based on your emergency unlock history — all stored locally.
                    </p>
                    <div className="space-y-3">
                        {overridePatterns.map((p) => (
                            <GlassCard key={p.id} className={`p-5 border ${severityStyle[p.severity]}`}>
                                <h4 className="font-bold text-white mb-1">{p.title}</h4>
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
        <h2 className="text-2xl font-bold text-white">Exports</h2>
        <GlassCard className="p-8 flex flex-col items-center justify-center h-64 text-center">
            <span className="text-neutral-500 text-sm font-bold uppercase tracking-widest mb-2">Export Data</span>
            <span className="text-neutral-400">CSV and JSON exports will be available here soon.</span>
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
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 text-sm font-bold"
                        aria-label="Dismiss tip"
                    >
                        ×
                    </button>
                    <p className="text-sm text-neutral-300 leading-relaxed pr-8">
                        <span className="font-bold text-white">How to track:</span> Add a habit, then tap the large check-in button each day. Your streak grows when you check in on consecutive days. You can also check in from the Today page habits grid.
                    </p>
                </GlassCard>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Habits</h2>
                    <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Build discipline through consistency</p>
                </div>
                <button
                    type="button"
                    onClick={() => setHabitModalOpen(true)}
                    className="glass-edge-btn px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-2xl text-xs font-black text-white transition-all shadow-lg shadow-purple-600/20 active:scale-95 flex items-center space-x-2"
                >
                    <Plus size={16} />
                    <span>CREATE HABIT</span>
                </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                {habits.length === 0 ? (
                    <GlassCard className="p-16 flex flex-col items-center justify-center text-center opacity-50 mx-auto max-w-lg">
                        <div className="w-16 h-16 min-w-[4rem] min-h-[4rem] shrink-0 bg-white/5 rounded-3xl flex items-center justify-center mb-4 mx-auto">
                            <IconCalendarStats size={32} className="text-neutral-500 shrink-0" stroke={1.5} />
                        </div>
                        <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs">No active habits</p>
                        <p className="text-neutral-600 text-sm mt-2 max-w-xs">Start your first streak by adding a habit above.</p>
                    </GlassCard>
                ) : (
                    habits.map((h: any) => {
                        const checkedToday = h.checkins?.includes(todayStr);
                        return (
                            <GlassCard key={h.id} className="p-6 group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-6">
                                        <HabitCheckInButton
                                            checked={checkedToday}
                                            onCheckIn={() => checkInHabit(h.id)}
                                        />
                                        <div>
                                            <p className={`text-xl font-black tracking-tight transition-colors ${checkedToday ? 'text-purple-400' : 'text-white'}`}>{h.name}</p>
                                            <div className="flex items-center space-x-3 mt-1">
                                                <div className="flex items-center space-x-1">
                                                    <Zap size={12} className={h.streak > 0 ? 'text-orange-400' : 'text-neutral-600'} />
                                                    <span className="text-xs font-black text-neutral-500 uppercase tracking-widest">{h.streak || 0} DAY STREAK</span>
                                                </div>
                                                <span className="text-neutral-800">•</span>
                                                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                                    {checkedToday ? 'COMPLETED TODAY' : 'PENDING CHECK-IN'}
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
                                                        className={`w-3 h-3 rounded-[3px] transition-all duration-300
                                                            ${checked ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-white/5'}`}
                                                        title={ds}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <button onClick={() => removeHabit(h.id)} className="p-3 text-neutral-700 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-red-400/10 rounded-xl">
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
            <h2 className="text-2xl font-bold text-white">Tasks & Planning</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
                <GlassCard className="p-8 h-[750px] flex flex-col">
                    <div className="flex space-x-3 mb-8">
                        <input type="time" value={newPlanTime} onChange={e => setNewPlanTime(e.target.value)}
                            className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors w-32" />
                        <input value={newPlanTask} onChange={e => setNewPlanTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlanItem()}
                            placeholder="What needs to get done?"
                            className="flex-1 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors min-w-0" />
                        <button onClick={addPlanItem} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition-all whitespace-nowrap">ADD</button>
                    </div>
                    
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                        {planner.map((p: any) => (
                            <div key={p.id} className="flex items-center space-x-4 p-4 bg-[#111] border border-white/5 rounded-xl group hover:border-white/10 transition-colors">
                                <button onClick={() => togglePlanItem(p.id)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${p.done ? 'bg-purple-500' : 'bg-white/10'}`}>
                                    {p.done && <Check size={14} className="text-white" />}
                                </button>
                                <span className="text-xs font-bold text-purple-400 w-12 flex-shrink-0">{p.time}</span>
                                <span className={`flex-1 text-sm font-medium truncate ${p.done ? 'line-through text-neutral-500' : 'text-white'}`}>{p.task}</span>
                                <button onClick={() => removePlanItem(p.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all flex-shrink-0"><Trash size={16} /></button>
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
    const { engineState, fetchEngineState } = useAuthStore();
    const defaultPomo = engineState.pomodoroSettings || { focusMin: 25, breakMin: 5, sessionsCompleted: 0, lastDate: '' };
    const [pomoRunning, setPomoRunning] = useState(false);
    const [pomoTimeLeft, setPomoTimeLeft] = useState(defaultPomo.focusMin * 60);
    const [isBreak, setIsBreak] = useState(false);
    const [pomoEndAt, setPomoEndAt] = useState<number | null>(null);
    const timerRef = useRef<number | null>(null);
    const completingRef = useRef(false);
    const [pomoNotice, setPomoNotice] = useState('');

    // Scratches State
    const [noteText, setNoteText] = useState(engineState.scratchpad || '');
    const [scratchList, setScratchList] = useState<{ id: number; title: string; body: string }[]>([]);
    const [activeScratchId, setActiveScratchId] = useState<number | null>(null);
    const [scratchFullscreen, setScratchFullscreen] = useState(false);
    const [renamingScratchId, setRenamingScratchId] = useState<number | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const persistScratchList = (next: { id: number; title: string; body: string }[]) => {
        setScratchList(next);
        chrome.storage.local.set({ scratchNotesV1: next });
    };
    const saveNote = async () => {
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { scratchpad: noteText } }, () => r()));
        if (activeScratchId) {
            const next = scratchList.map((n) => (n.id === activeScratchId ? { ...n, body: noteText } : n));
            persistScratchList(next);
        }
    };
    const addScratch = () => {
        const n = { id: Date.now(), title: `Scratch ${scratchList.length + 1}`, body: '' };
        const next = [n, ...scratchList];
        persistScratchList(next);
        setActiveScratchId(n.id);
        setNoteText('');
    };

    const startRenameScratch = (id: number, title: string) => {
        setRenamingScratchId(id);
        setRenameDraft(title);
    };

    const commitRenameScratch = () => {
        if (renamingScratchId == null) return;
        const title = renameDraft.trim() || 'Untitled';
        const next = scratchList.map((n) =>
            n.id === renamingScratchId ? { ...n, title } : n,
        );
        persistScratchList(next);
        setRenamingScratchId(null);
        setRenameDraft('');
    };

    useEffect(() => {
        chrome.storage.local.get('scratchNotesV1', (result) => {
            const list = (result.scratchNotesV1 as { id: number; title: string; body: string }[]) || [];
            setScratchList(list);
            if (list.length) {
                setActiveScratchId(list[0].id);
                setNoteText(list[0].body || '');
            }
        });
    }, []);

    const buildRuntime = (
        partial: Partial<PomodoroRuntime> & { running: boolean; paused: boolean },
    ): PomodoroRuntime => ({
        running: partial.running,
        paused: partial.paused,
        endAt: partial.endAt ?? null,
        timeLeftSec: partial.timeLeftSec ?? Math.round(defaultPomo.focusMin * 60),
        isBreak: partial.isBreak ?? isBreak,
        segmentTotalSec:
            partial.segmentTotalSec ??
            Math.round(((partial.isBreak ?? isBreak) ? defaultPomo.breakMin : defaultPomo.focusMin) * 60),
        focusMin: defaultPomo.focusMin,
        breakMin: defaultPomo.breakMin,
    });

    const applyRuntimeToUi = (rt: PomodoroRuntime | null) => {
        if (!rt) {
            setPomoRunning(false);
            setPomoEndAt(null);
            setIsBreak(false);
            setPomoTimeLeft(defaultPomo.focusMin * 60);
            return;
        }
        setIsBreak(rt.isBreak);
        setPomoRunning(rt.running && !rt.paused);
        setPomoEndAt(rt.running && !rt.paused ? rt.endAt : null);
        setPomoTimeLeft(computeTimeLeft(rt));
    };

    const persistRuntime = async (rt: PomodoroRuntime | null) => {
        await writePomodoroRuntime(rt);
        applyRuntimeToUi(rt);
    };

    useEffect(() => {
        void readPomodoroRuntime().then(applyRuntimeToUi);
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
    }, [defaultPomo.focusMin, defaultPomo.breakMin]);

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
    }, [fetchEngineState]);

    useEffect(() => {
        if (!pomoRunning || !pomoEndAt || pomoTimeLeft > 0 || completingRef.current) return;
        completingRef.current = true;
        chrome.runtime.sendMessage({ type: 'POMODORO_SEGMENT_COMPLETE' }, () => {
            completingRef.current = false;
        });
    }, [pomoTimeLeft, pomoRunning, pomoEndAt]);

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

    return (
        <div className="space-y-6 animate-fade-in-up max-w-[1200px] mx-auto">
            <h2 className="text-2xl font-bold text-white">Focus Sessions</h2>
            {pomoNotice && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                    {pomoNotice}
                </div>
            )}
            
            <DeepWorkPlanner />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="p-8 flex flex-col items-center justify-center w-full min-h-[440px]">
                    <div className="w-full flex flex-col items-center text-center gap-3 mb-6">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                            {isBreak ? 'Break Time' : 'Focus Session'}
                        </span>
                        <div className="flex items-center justify-center gap-2 text-neutral-500">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                                Focus
                                <input
                                    type="number"
                                    min="0.5"
                                    max="120"
                                    step="0.5"
                                    value={defaultPomo.focusMin}
                                    onChange={async (e) => {
                                        const v = parseFloat(e.target.value) || 25;
                                        const updated = { ...defaultPomo, focusMin: v };
                                        await new Promise<void>((r) =>
                                            chrome.runtime.sendMessage(
                                                { type: 'UPDATE_ENGINE_SETTINGS', settings: { pomodoroSettings: updated } },
                                                () => r(),
                                            ),
                                        );
                                        if (!pomoRunning && !isBreak) setPomoTimeLeft(Math.round(v * 60));
                                        fetchEngineState();
                                    }}
                                    className="w-14 sm:w-16 bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-center text-xs text-white outline-none"
                                />
                            </label>
                            <span className="text-neutral-600">/</span>
                            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                                Break
                                <input
                                    type="number"
                                    min="0.5"
                                    max="60"
                                    step="0.5"
                                    value={defaultPomo.breakMin}
                                    onChange={async (e) => {
                                        const v = parseFloat(e.target.value) || 5;
                                        const updated = { ...defaultPomo, breakMin: v };
                                        await new Promise<void>((r) =>
                                            chrome.runtime.sendMessage(
                                                { type: 'UPDATE_ENGINE_SETTINGS', settings: { pomodoroSettings: updated } },
                                                () => r(),
                                            ),
                                        );
                                        if (!pomoRunning && isBreak) setPomoTimeLeft(Math.round(v * 60));
                                        fetchEngineState();
                                    }}
                                    className="w-12 sm:w-14 bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-center text-xs text-white outline-none"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-center w-full my-2">
                        <div className="relative w-56 h-56 sm:w-60 sm:h-60 shrink-0">
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
                                    strokeDashoffset={`${2 * Math.PI * 82 * (1 - pomoTimeLeft / ((isBreak ? defaultPomo.breakMin : defaultPomo.focusMin) * 60))}`}
                                    className="transition-all duration-1000"
                                />
                            </svg>
                            <div className="absolute inset-[22%] flex flex-col items-center justify-center text-center pointer-events-none">
                                <span className="text-3xl font-black text-white tabular-nums leading-none">
                                    {formatTime(pomoTimeLeft)}
                                </span>
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-2">
                                    {defaultPomo.sessionsCompleted} sessions today
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center gap-3 mt-6 w-full">
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
                                            segmentTotalSec: left,
                                        }),
                                    );
                                } else {
                                    const endAt = Date.now() + pomoTimeLeft * 1000;
                                    await persistRuntime(
                                        buildRuntime({
                                            running: true,
                                            paused: false,
                                            endAt,
                                            timeLeftSec: pomoTimeLeft,
                                            isBreak,
                                            segmentTotalSec: pomoTimeLeft,
                                        }),
                                    );
                                }
                            })();
                        }}
                            className={`px-10 py-4 rounded-xl font-bold text-sm transition-all flex items-center space-x-2 ${pomoRunning ? 'bg-white/10 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>
                            {pomoRunning ? <><Pause size={18} /><span>PAUSE</span></> : <><Play size={18} /><span>START</span></>}
                        </button>
                        <button onClick={() => {
                            void persistRuntime(null);
                        }}
                            className="px-5 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </GlassCard>

                <GlassCard className="p-8 flex flex-col min-h-[500px] relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-white">Scratchpad</h3>
                        <div className="flex items-center gap-2">
                            {activeScratchId != null && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const active = scratchList.find((n) => n.id === activeScratchId);
                                        if (active) startRenameScratch(active.id, active.title);
                                    }}
                                    className="p-1.5 rounded-lg bg-white/10 text-white"
                                    title="Rename scratch"
                                >
                                    <Pencil size={12} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={addScratch}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white/10 text-white"
                            >
                                <Plus size={12} className="inline mr-1" />
                                NEW
                            </button>
                            <button
                                type="button"
                                onClick={() => setScratchFullscreen(true)}
                                className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                                title="Fullscreen"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                    </div>
                    {renamingScratchId != null && (
                        <div className="mb-3 flex gap-2">
                            <input
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRenameScratch();
                                    if (e.key === 'Escape') setRenamingScratchId(null);
                                }}
                                className="flex-1 bg-[#111] border border-purple-500/40 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={commitRenameScratch}
                                className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold"
                            >
                                Save
                            </button>
                        </div>
                    )}
                    {scratchList.length > 0 && (
                        <div className="flex gap-1.5 mb-3 overflow-x-auto">
                            {scratchList.map((n) => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveScratchId(n.id);
                                        setNoteText(n.body || '');
                                    }}
                                    className={`px-2 py-1 rounded-md text-[10px] whitespace-nowrap border ${
                                        activeScratchId === n.id
                                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                                            : 'bg-white/5 border-white/10 text-neutral-400'
                                    }`}
                                >
                                    {n.title}
                                </button>
                            ))}
                        </div>
                    )}
                    <textarea
                        value={noteText}
                        onChange={e => {
                            const value = e.target.value;
                            setNoteText(value);
                            if (activeScratchId) {
                                const next = scratchList.map((n) => (n.id === activeScratchId ? { ...n, body: value } : n));
                                persistScratchList(next);
                            }
                        }}
                        onBlur={saveNote}
                        className="w-full flex-1 min-h-[280px] bg-[#111] border border-white/10 rounded-2xl p-6 text-white text-sm focus:border-purple-500 outline-none transition-colors resize-none font-mono"
                        placeholder="Jot down distracting thoughts or notes here while you focus. Auto-saves when you click away."
                    />

                    <AnimatePresence>
                        {scratchFullscreen && (
                            <motion.div
                                className="fixed inset-0 z-[500] bg-[#050505] flex flex-col"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <motion.div
                                    className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0a0a0a]"
                                    initial={{ y: -12, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.05, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <span className="text-sm font-bold text-white">
                                        {scratchList.find((n) => n.id === activeScratchId)?.title || 'Scratchpad'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void saveNote();
                                            setScratchFullscreen(false);
                                        }}
                                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                                    >
                                        <Minimize2 size={16} />
                                    </button>
                                </motion.div>
                                <motion.div
                                    className="flex-1 flex flex-col min-h-0"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <textarea
                                        value={noteText}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setNoteText(value);
                                            if (activeScratchId) {
                                                const next = scratchList.map((n) =>
                                                    n.id === activeScratchId ? { ...n, body: value } : n,
                                                );
                                                persistScratchList(next);
                                            }
                                        }}
                                        onBlur={saveNote}
                                        className="flex-1 w-full h-full bg-[#050505] text-white text-base p-6 sm:p-10 outline-none resize-none font-mono leading-relaxed"
                                        placeholder="Write freely…"
                                        autoFocus
                                    />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </GlassCard>
            </div>
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

    const blocklistCount = Object.keys(engineState.blocklist || {}).filter(
        (d) => engineState.blocklist[d],
    ).length;

    const [challengeState, setChallengeState] = useState<{
        isOpen: boolean;
        domain: string;
        type: string;
        phrase: string;
    }>({ isOpen: false, domain: '', type: '', phrase: '' });

    const executeAction = async (type: string, domain: string, action: 'add' | 'remove') => {
        await new Promise<void>((r) =>
            chrome.runtime.sendMessage(
                { type: `${action.toUpperCase()}_${type.toUpperCase()}`, domain: domain.trim() },
                () => r(),
            ),
        );
        fetchEngineState();
        setChallengeState((prev) => ({ ...prev, isOpen: false }));
    };

    const disableChallenge = async () => {
        await new Promise<void>((r) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { requireChallenge: false } },
                () => r(),
            ),
        );
        fetchEngineState();
        setChallengeState((prev) => ({ ...prev, isOpen: false }));
    };

    const triggerAction = async (type: string, domain: string, action: 'add' | 'remove') => {
        if (!domain.trim()) return;
        if (action === 'remove' && engineState.requireChallenge) {
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

    return (
        <div className="space-y-6 animate-fade-in-up w-full">
            <ChallengeModal
                isOpen={challengeState.isOpen}
                phrase={challengeState.phrase}
                onClose={() => setChallengeState((prev) => ({ ...prev, isOpen: false }))}
                onComplete={() => executeAction(challengeState.type, challengeState.domain, 'remove')}
                onDisableChallenge={disableChallenge}
            />
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white">Site Management</h2>
            </div>

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
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${on ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 hover:text-white'}`}
                                title={desc}
                            >
                                <span className={`w-2 h-2 rounded-full ${on ? 'bg-red-500' : 'bg-neutral-600'}`} />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard className="p-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white text-lg">Blocked List</h3>
                        <Ban size={20} className="text-red-400" />
                    </div>
                    <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mb-4">
                        Supports subdomains (sub.site.com) and routes (site.com/path)
                    </p>
                    <div className="flex space-x-3 mb-8">
                        <input
                            value={newBlocked}
                            onChange={e => setNewBlocked(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { triggerAction('block', newBlocked, 'add'); setNewBlocked(''); } }}
                            placeholder="site.com or sub.site.com/path"
                            className="flex-1 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none transition-colors text-white"
                        />
                        <button
                            onClick={() => { triggerAction('block', newBlocked, 'add'); setNewBlocked(''); }}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-6 py-3 rounded-xl text-sm font-bold transition-all"
                        >Add</button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
                        {Array.from(new Set([
                            ...Object.keys(engineState.blocklist || {}),
                            ...Object.keys(engineState.schedules || {}),
                            ...Object.keys(engineState.timers || {})
                        ])).map(domain => (
                            <div key={domain as string} className="flex items-center justify-between p-4 bg-[#111] rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                                <span className="text-sm font-medium text-white">{domain}</span>
                                <button
                                    type="button"
                                    onClick={() => triggerAction('block', domain as string, 'remove')}
                                    className="flex-shrink-0 p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-100 sm:opacity-60 sm:group-hover:opacity-100 relative z-10"
                                    aria-label={`Remove ${domain}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <GlassCard className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white text-lg">Allowed (Whitelist)</h3>
                        <Globe size={20} className="text-green-400" />
                    </div>
                    <div className="flex space-x-3 mb-8">
                        <input
                            value={newAllowed}
                            onChange={e => setNewAllowed(e.target.value)}
                            placeholder="trustedsite.com"
                            className="flex-1 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500 outline-none transition-colors text-white"
                        />
                        <button
                            onClick={() => { triggerAction('allowed_site', newAllowed, 'add'); setNewAllowed(''); }}
                            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-6 py-3 rounded-xl text-sm font-bold transition-all"
                        >Add</button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
                        {(engineState.allowedSites || []).map((domain: string) => (
                            <div key={domain} className="flex items-center justify-between p-4 bg-[#111] rounded-xl border border-white/5 group hover:border-white/10 transition-all">
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
            <GlassCard className="p-10 border-red-500/20 bg-red-900/5 relative overflow-hidden">
                <div className="flex items-center space-x-4 mb-4">
                    <div className="relative">
                        <Zap size={24} className="text-red-500 relative z-10" style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.8)) drop-shadow(0 0 16px rgba(239,68,68,0.4))' }} />
                        <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20" style={{ animationDuration: '2s' }} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Nuclear Lockdown</h3>
                    <span className="text-[10px] font-bold text-red-500/60 uppercase tracking-widest">⚠ IRREVERSIBLE</span>
                </div>
                
                {engineState.nuclearState?.active ? (
                    <div className="p-6 bg-red-600/20 border border-red-500/40 rounded-3xl text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.08)_0%,transparent_70%)] animate-pulse" />
                        <span className="text-red-400 font-bold text-lg relative z-10">☢ NUCLEAR LOCKDOWN ACTIVE ☢</span>
                        <div className="text-3xl font-black text-white mt-2 relative z-10">
                            {Math.max(0, Math.ceil((engineState.nuclearState.endTime - Date.now()) / 60000))}M REMAINING
                        </div>
                        <p className="text-xs text-red-400/60 mt-4 font-bold uppercase tracking-widest relative z-10">Un-cancellable by design.</p>
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
                                    className={`glass-edge-btn px-4 py-2 text-xs font-bold ${
                                        nuclearDuration === m
                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400/40'
                                            : 'text-neutral-400'
                                    }`}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <div className="flex items-center glass-edge-btn rounded-2xl px-4 py-3 w-full sm:w-48 shrink-0">
                                <span className="text-neutral-500 text-xs font-bold uppercase tracking-widest mr-3">Custom</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={nuclearDuration}
                                    onChange={(e) => setNuclearDuration(parseInt(e.target.value, 10) || 1)}
                                    className="bg-transparent text-white font-black text-lg outline-none w-full"
                                />
                                <span className="text-neutral-500 text-xs font-bold ml-1">MIN</span>
                            </div>
                            <button
                                type="button"
                                disabled={blocklistCount === 0}
                                onClick={() => setNukeModalOpen(true)}
                                className="flex-1 px-8 py-4 text-base font-black uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 rounded-xl"
                                style={{
                                    background: blocklistCount > 0
                                        ? 'linear-gradient(180deg, #fde047 0%, #eab308 55%, #ca8a04 100%)'
                                        : '#333',
                                    color: '#000',
                                    border: '3px solid #000',
                                    boxShadow: blocklistCount > 0
                                        ? '0 0 20px rgba(250, 204, 21, 0.35), inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)'
                                        : 'none',
                                    outline: blocklistCount > 0 ? '2px solid #facc15' : 'none',
                                    outlineOffset: '2px',
                                }}
                            >
                                ☢ Nuke em!
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
                    await chrome.runtime.sendMessage({
                        type: 'START_NUCLEAR',
                        target: 'blocked',
                        duration: nuclearDuration,
                    });
                    fetchEngineState();
                }}
            />
        </div>
    );
};

export const StatisticsTab = () => {
    const { last7DaysStats } = useAuthStore();
    const [selectedSite, setSelectedSite] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ site: string; time: number; pct: number; x: number; y: number } | null>(null);
    const donutHostRef = useRef<HTMLDivElement>(null);
    const graphContainerRef = useRef<HTMLDivElement>(null);
    const [graphContainerWidth, setGraphContainerWidth] = useState(640);

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
    const padX = 24;
    const padBottom = 48;
    const plotW = graphWidth - padX * 2;
    const xStep = chartData.length > 1 ? plotW / (chartData.length - 1) : plotW;

    const linePath = chartData.map((day: any, i: number) => {
        const x = padX + i * xStep;
        const y = graphHeight - padBottom - Math.max(8, (day.total / maxTime) * (graphHeight - padBottom - 16));
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    return (
        <div className="space-y-6 animate-fade-in-up w-full">
            <h2 className="text-2xl font-bold text-white">Statistics & Analytics</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LINE GRAPH */}
                <GlassCard className="p-6 flex flex-col" style={{ height: '420px' }}>
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <h3 className="font-bold text-white text-sm">Weekly Activity</h3>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Click a point to see its breakdown</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setWindowEnd(resolvedEnd - 7)}
                                disabled={!canGoBack}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-white text-xs font-bold"
                            >‹</button>
                            <button
                                onClick={() => setWindowEnd(Math.min(resolvedEnd + 7, allStats.length - 1))}
                                disabled={!canGoForward}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-white text-xs font-bold"
                            >›</button>
                        </div>
                    </div>

                    <div ref={graphContainerRef} className="flex-1 relative w-full mt-4 min-h-[260px]">
                        <svg
                            viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                            className="w-full h-full max-h-[280px]"
                            preserveAspectRatio="xMidYMid meet"
                        >
                            <defs>
                                <linearGradient id="lineGrad2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(168,85,247,0.25)" />
                                    <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                                </linearGradient>
                            </defs>

                            {/* Y-axis grid lines with labels */}
                            {[0.25, 0.5, 0.75, 1].map(f => {
                                const y = graphHeight - padBottom - f * (graphHeight - padBottom - 16);
                                return (
                                    <g key={f}>
                                        <line
                                            x1={padX} y1={y}
                                            x2={graphWidth - padX} y2={y}
                                            stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                                        />
                                        <text x={padX - 2} y={y + 4} textAnchor="end" fill="#444" fontSize="9" fontWeight="600">
                                            {formatTime(maxTime * f)}
                                        </text>
                                    </g>
                                );
                            })}

                            <path
                                d={`${linePath} L ${padX + (chartData.length - 1) * xStep} ${graphHeight - padBottom} L ${padX} ${graphHeight - padBottom} Z`}
                                fill="url(#lineGrad2)"
                                className="transition-all duration-700"
                            />
                            <path
                                d={linePath}
                                fill="none"
                                stroke="#a855f7"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-700"
                            />

                            {chartData.map((day: any, i: number) => {
                                const x = padX + i * xStep;
                                const y = graphHeight - padBottom - Math.max(8, (day.total / maxTime) * (graphHeight - padBottom - 16));
                                const sel = i === selectedIdxClamped;
                                return (
                                    <g key={i} onClick={() => setSelectedDateIdx(i)} className="cursor-pointer">
                                        <circle cx={x} cy={y} r={sel ? 7 : 4} fill={sel ? '#fff' : '#a855f7'} className="transition-all duration-200" />
                                        {sel && <circle cx={x} cy={y} r={12} fill="rgba(168,85,247,0.15)" className="transition-all" />}
                                        <text
                                            x={x} y={graphHeight - padBottom + 22}
                                            textAnchor="middle"
                                            fill={sel ? '#a855f7' : '#555'}
                                            fontSize="11"
                                            fontWeight={sel ? '700' : '400'}
                                        >
                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                        </text>
                                        {sel && (
                                            <text x={x} y={graphHeight - padBottom + 36} textAnchor="middle" fill="#888" fontSize="9">
                                                {formatTime(day.total)}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </GlassCard>

                {/* HALF PIE CHART */}
                <GlassCard className="p-6 flex flex-col relative" style={{ minHeight: '420px' }}>
                    <div className="mb-2">
                        <h3 className="font-bold text-white text-sm">Date Breakdown</h3>
                        <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">
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
                                    <span className="text-white font-bold text-xs truncate max-w-[110px]">{tooltip.site}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-400 text-xs">{formatTime(tooltip.time)}</span>
                                    <span className="text-purple-400 font-black text-sm">{tooltip.pct}%</span>
                                </div>
                            </div>
                        )}
                        </div>
                        {slices.length === 0 && (
                            <p className="text-neutral-500 text-xs font-bold mt-2">No usage this day</p>
                        )}
                    </div>

                    <div className="mt-3 border-t border-white/5 pt-3 mb-2">
                        {selectedSite ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <img src={`https://s2.googleusercontent.com/s2/favicons?domain=${selectedSite}&sz=64`} alt="" className="w-10 h-10 rounded-lg bg-white/5 p-1 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-base font-bold text-white truncate">{selectedSite}</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Selected</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                    <span className="text-2xl font-black text-purple-400">
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
                                    <span className="text-[10px] text-neutral-500 w-10 text-right">{formatTime(slice.time)}</span>
                                    <span className="text-[10px] font-bold text-purple-400 w-7 text-right">{slice.pct}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};


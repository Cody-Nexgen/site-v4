import { useAuthStore } from '../lib/store';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Plus, Check, Trash2, ShieldBan, Flame, Timer, Gauge, ListChecks } from 'lucide-react';
import { Dialog } from '../components/fz/Dialog';
import { capDayScreenMs } from '../lib/screenTimeCap';
import { HabitDayCell } from '../components/pro-dashboard/HabitCheckInButton';
import HabitNameModal from '../components/HabitNameModal';
import { computeFocusScore } from '../lib/focusScore';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { FocusLevelCard } from '../components/FocusLevelCard';
import { ActivityGraph } from './OptionsApp';
import { computeHabitStreak } from '../lib/habitStreak';
import { KpiCard } from '../components/dashboard/KpiCard';
import { SparkMetricCard } from '../components/dashboard/SparkMetricCard';
import { SurfaceCard } from '../components/dashboard/primitives';
import { EmptyState } from '../components/dashboard/primitives';

export default function OverviewTab() {
    const { engineState, last7DaysStats, fetchEngineState, offsetWeeks, setOffsetWeeks, dashboardStreak, importHistory } = useAuthStore();
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
    const diffPercent = yesterdayTotal === 0 ? 0 : Math.round((diff / yesterdayTotal) * 100);
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

    const planSeq = useRef(0);
    /** Show the new planner at once, save it, then re-sync unless a newer edit is already on its way. */
    const savePlanner = async (updated: typeof planner) => {
        const seq = ++planSeq.current;
        useAuthStore.setState((s) => ({ engineState: { ...s.engineState, dailyPlanner: updated } }));
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        if (seq === planSeq.current) await fetchEngineState();
    };

    const addPlanItem = async () => {
        const task = newTaskName.trim();
        if (!task) return;
        setNewTaskName('');
        await savePlanner([...planner, { id: Date.now(), time: 'Anytime', task, done: false }]);
    };

    const togglePlanItem = (id: number) =>
        savePlanner(planner.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));

    const deletePlanItem = (id: number) => savePlanner(planner.filter((p) => p.id !== id));

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
    const nextSession = planner.find((p: { done: boolean }) => !p.done) ?? null;
    const habitsDue = habits.filter(
        (h: { checkins?: string[] }) => !h.checkins?.includes(todayStr),
    );

    const focusMin = engineState.pomodoroSettings?.focusMin || 25;
    const todayFocusMs =
        (endIdx >= 0 ? last7DaysStats[endIdx]?.focusMs : 0) ||
        pomodoroToday * focusMin * 60 * 1000;
    const yesterdayFocusMs = endIdx > 0 ? last7DaysStats[endIdx - 1]?.focusMs || 0 : 0;
    const focusDiff = todayFocusMs - yesterdayFocusMs;
    const focusDiffPercent =
        yesterdayFocusMs === 0 ? 0 : Math.round((Math.abs(focusDiff) / yesterdayFocusMs) * 100);
    const focusIsUp = focusDiff > 0;

    const sparkPoints = useMemo(
        () =>
            weekStats.map((s) => ({
                label: new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }),
                value: s.focusMs || 0,
            })),
        [weekStats],
    );

    return (
        <div className="relative space-y-6 animate-fade-in-up font-sans">
            {progression && <FocusLevelCard progression={progression} compact />}


            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                    label="Focuz score"
                    value={focusResult.score}
                    tone="warm"
                    icon={<Gauge className="h-3.5 w-3.5" />}
                    caption="Today"
                />
                <KpiCard
                    label="Screen time"
                    value={formatTime(todayTotal)}
                    delta={diffPercent}
                    trend={diff === 0 ? 'flat' : isUp ? 'up' : 'down'}
                    tone="cool"
                    icon={<Timer className="h-3.5 w-3.5" />}
                    caption="vs yesterday"
                />
                <KpiCard
                    label="Blocked"
                    value={blockedCount}
                    tone="danger"
                    icon={<ShieldBan className="h-3.5 w-3.5" />}
                    caption="Distractions stopped"
                />
                <KpiCard
                    label="Streak"
                    value={`${dashboardStreak}d`}
                    tone="warm"
                    icon={<Flame className="h-3.5 w-3.5" />}
                    caption="Keep it going"
                />
            </div>

            <SurfaceCard className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--fz-bg-raised)] text-[var(--fz-text-3)] ring-1 ring-[var(--fz-border)]">
                        <Timer className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-foreground">Pomodoro</p>
                        <p className="text-[11px] text-muted-foreground">
                            {pomodoroToday} session{pomodoroToday === 1 ? '' : 's'} completed today
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('focuznow-navigate-tab', { detail: 'sessions' }))}
                    className="text-[11px] font-medium text-foreground/80 hover:text-foreground transition-colors shrink-0"
                >
                    Open →
                </button>
            </SurfaceCard>

            <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3 xl:items-stretch">
                <SurfaceCard className="overflow-hidden min-h-[320px]">
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Weekly activity</h2>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                {isUp ? '↑' : '↓'} {Math.abs(diffPercent)}% vs yesterday
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-muted-foreground">{weekRangeLabel}</span>
                            <button
                                type="button"
                                disabled={!canGoOlder}
                                onClick={() => setOffsetWeeks(offsetWeeks + 1)}
                                className="w-7 h-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                aria-label="Older week"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                disabled={offsetWeeks === 0}
                                onClick={() => setOffsetWeeks(Math.max(0, offsetWeeks - 1))}
                                className="w-7 h-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                aria-label="Newer week"
                            >
                                ›
                            </button>
                        </div>
                    </div>
                    <div className="px-2 pb-4 h-56 sm:h-64 md:h-72">
                        <ActivityGraph stats={weekStats} onSelectDay={setSelectedDay} />
                    </div>
                    <div className="px-5 pb-4 flex justify-between text-meta text-muted-foreground">
                        {weekStats.map((s, i) => (
                            <span key={i}>{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        ))}
                    </div>
                </SurfaceCard>

                {/* §6.1: Today card — next session + habits due. */}
                <SurfaceCard className="p-5 flex flex-col min-h-[320px]">
                    <div className="mb-4">
                        <h2 className="text-title-3 text-foreground">Today</h2>
                        <p className="text-meta text-muted-foreground mt-1">
                            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-label text-muted-foreground mb-2">Next session</p>
                            {nextSession ? (
                                <div className="flex items-center gap-2.5 rounded-[var(--fz-radius-md)] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 py-2.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--fz-accent)] shrink-0" />
                                    <span className="text-body-sm text-foreground truncate flex-1">{nextSession.task}</span>
                                    <span className="text-meta text-muted-foreground tabular-nums shrink-0">{nextSession.time}</span>
                                </div>
                            ) : (
                                <p className="text-body-sm text-muted-foreground">Nothing scheduled.</p>
                            )}
                        </div>
                        <div>
                            <p className="text-label text-muted-foreground mb-2">Habits due</p>
                            {habitsDue.length === 0 ? (
                                <p className="text-body-sm text-muted-foreground">All habits checked in.</p>
                            ) : (
                                <div className="space-y-1">
                                    {habitsDue.slice(0, 4).map((h: { id: number; name: string }) => (
                                        <button
                                            key={h.id}
                                            type="button"
                                            onClick={() => checkInHabit(h.id, todayStr)}
                                            className="flex w-full items-center gap-2.5 rounded-[var(--fz-radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--fz-bg-hover)]"
                                        >
                                            <span className="h-4 w-4 rounded border border-[var(--fz-border-strong)] shrink-0" />
                                            <span className="text-body-sm text-foreground truncate">{h.name}</span>
                                        </button>
                                    ))}
                                    {habitsDue.length > 4 && (
                                        <p className="text-meta text-muted-foreground px-2">+{habitsDue.length - 4} more</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-auto pt-4">
                        <SparkMetricCard
                            title="Focus time"
                            value={formatTime(todayFocusMs)}
                            deltaLabel={`${focusIsUp ? '+' : '−'}${focusDiffPercent}%`}
                            points={sparkPoints}
                            formatPointValue={(ms) => formatTime(ms)}
                            className="!border-0 !bg-transparent !p-0 !shadow-none"
                        />
                    </div>
                </SurfaceCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <SurfaceCard className="p-5 flex flex-col min-h-[320px]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
                            <p className="text-[11px] text-muted-foreground">{doneTasks}/{planner.length} complete</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addPlanItem()}
                            placeholder="Add a task"
                            className="flex-1 bg-input/40 border border-border rounded-[var(--radius)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring placeholder:text-muted-foreground"
                        />
                        <button type="button" onClick={addPlanItem} className="px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
                            Add
                        </button>
                    </div>
                    <div className="flex-1 space-y-1 overflow-y-auto">
                        {planner.length === 0 && (
                            <EmptyState
                                icon={<ListChecks className="h-4 w-4" />}
                                title="No tasks yet"
                                description="Add what you want to get done today and tick it off as you go."
                            />
                        )}
                        {planner.map((p: { id: number; task: string; done: boolean }) => (
                            <div
                                key={p.id}
                                className="group flex w-full items-center rounded-[var(--radius)] transition-colors hover:bg-accent/60 focus-within:bg-accent/60"
                            >
                                <button
                                    type="button"
                                    onClick={() => togglePlanItem(p.id)}
                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                    aria-label={`${p.done ? 'Mark incomplete' : 'Mark complete'}: ${p.task}`}
                                    aria-pressed={p.done}
                                >
                                    <span className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${p.done ? 'bg-primary border-primary' : 'border-border'}`}>
                                        {p.done && <Check size={12} className="text-primary-foreground" />}
                                    </span>
                                    <span className={`text-sm truncate ${p.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{p.task}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void deletePlanItem(p.id);
                                    }}
                                    className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60 group-hover:opacity-100"
                                    aria-label={`Delete task: ${p.task}`}
                                    title={`Delete ${p.task}`}
                                >
                                    <Trash2 size={15} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>
                </SurfaceCard>

                <SurfaceCard className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Habits</h2>
                            <p className="text-[11px] text-muted-foreground">{habits.length} active</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setOffsetWeeks(offsetWeeks + 1)} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent">‹</button>
                            <button type="button" disabled={offsetWeeks === 0} onClick={() => setOffsetWeeks(Math.max(0, offsetWeeks - 1))} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-30">›</button>
                            <button type="button" onClick={() => setHabitModalOpen(true)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center ml-1">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    {habits.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-12 text-center">Add a habit to track consistency.</p>
                    ) : (
                        <div className="space-y-3">
                            {habits.slice(0, 5).map((h: { id: number; name: string; streak?: number; checkins?: string[] }) => (
                                <div key={h.id} className="rounded-[var(--radius)] border border-border bg-muted/30 px-3 py-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-foreground">{h.name}</span>
                                        <span className="text-xs font-semibold text-muted-foreground">
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
                </SurfaceCard>
            </div>

            <Dialog
                open={!!selectedDay}
                onClose={() => setSelectedDay(null)}
                size="md"
                title={selectedDay ? new Date(selectedDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
            >
                {selectedDay && (
                    <>
                        <div className="mb-4">
                            <p className="text-stat text-[var(--fz-text-1)] tabular-nums">{formatTime(selectedDay.total)}</p>
                            <p className="text-meta text-[var(--fz-text-3)] mt-0.5">
                                Total screen time
                                {selectedDay.focusMs ? ` · ${formatTime(selectedDay.focusMs)} focus` : ''}
                            </p>
                        </div>
                        <div className="max-h-72 overflow-y-auto -mx-1">
                            {Object.entries(selectedDay.sites ?? {})
                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                .slice(0, 12)
                                .map(([site, ms]) => (
                                    <div key={site} className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--fz-radius-md)] hover:bg-[var(--fz-bg-hover)] transition-colors">
                                        <img
                                            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=32`}
                                            alt=""
                                            className="w-5 h-5 rounded shrink-0"
                                            loading="lazy"
                                        />
                                        <span className="text-body-sm text-[var(--fz-text-1)] truncate flex-1">{site}</span>
                                        <span className="text-meta font-medium text-[var(--fz-text-3)] tabular-nums shrink-0">{formatTime(ms as number)}</span>
                                    </div>
                                ))}
                            {Object.keys(selectedDay.sites ?? {}).length === 0 && (
                                <p className="text-body-sm text-[var(--fz-text-3)] text-center py-8">No sites recorded that day.</p>
                            )}
                        </div>
                    </>
                )}
            </Dialog>

            <HabitNameModal open={habitModalOpen} onClose={() => setHabitModalOpen(false)} onSubmit={addHabitByName} />
        </div>
    );
}

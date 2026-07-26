import { useAuthStore } from '../lib/store';
import { useMemo, useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, Checkbox, Input, Modal, useOverlayState } from '@heroui/react';
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
import {
    DashboardEmptyState,
    MetricCard,
    PageHeading,
    SectionCard,
    StatusChip,
} from '../components/dashboard/shell';

export default function OverviewTab() {
    const {
        streak,
        engineState,
        last7DaysStats,
        fetchEngineState,
        offsetWeeks,
        setOffsetWeeks,
        dashboardStreak,
        importHistory,
    } = useAuthStore();
    const { proGoldTheme, enabled: proVisuals } = useProDashboardVisuals();
    const { progression } = useFocusProgression();

    useEffect(() => {
        void importHistory();
    }, [importHistory]);

    const statsLen = last7DaysStats?.length || 0;
    const endIdx = statsLen - 1 - offsetWeeks * 7;
    const todayTotal = capDayScreenMs(endIdx >= 0 ? (last7DaysStats[endIdx]?.total || 0) : 0);
    const yesterdayTotal = capDayScreenMs(endIdx > 0 ? (last7DaysStats[endIdx - 1]?.total || 0) : 0);
    const blockedCount = engineState.blockedToday || 0;

    const diff = todayTotal - yesterdayTotal;
    const diffPercent = yesterdayTotal === 0 ? 0 : Math.round((Math.abs(diff) / yesterdayTotal) * 100);
    const isUp = diff > 0;

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
    const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
    const [habitModalOpen, setHabitModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<(typeof last7DaysStats)[0] | null>(null);
    const dayDetailState = useOverlayState({
        isOpen: !!selectedDay,
        onOpenChange: (open) => {
            if (!open) setSelectedDay(null);
        },
    });

    const addHabitByName = async (name: string) => {
        const updated = [...habits, { id: Date.now(), name, streak: 0, checkins: [], lastCheckin: '' }];
        await new Promise<void>((r) =>
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
        await new Promise<void>((r) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } },
                () => r(),
            ),
        );
        await fetchEngineState();
        await sendProgressionMessage({ type: 'PROGRESSION_HABIT_CHECKIN', habitId: id });
        useAuthStore.getState().recalculateStreak();
    };

    const addPlanItem = async () => {
        if (!newTaskName.trim()) return;
        const updated = [...planner, { id: Date.now(), time: 'Anytime', task: newTaskName.trim(), done: false }];
        await new Promise<void>((r) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } },
                () => r(),
            ),
        );
        setNewTaskName('');
        fetchEngineState();
    };

    const togglePlanItem = async (id: number) => {
        const updated = planner.map((p: { id: number; done: boolean }) =>
            p.id === id ? { ...p, done: !p.done } : p,
        );
        await new Promise<void>((r) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } },
                () => r(),
            ),
        );
        fetchEngineState();
    };

    const deletePlanItem = async (id: number) => {
        if (deletingTaskId !== null) return;
        setDeletingTaskId(id);
        try {
            const updated = planner.filter((p: { id: number }) => p.id !== id);
            await new Promise<void>((r) =>
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
            ? (engineState.pomodoroSettings?.sessionsCompleted ?? 0)
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
    const focusActive = Boolean(engineState.focusMode);

    return (
        <div className="relative space-y-6 pb-10 pt-2 animate-fade-in-up pro-page-enter font-sans">
            {proGoldTheme && proVisuals && <ProDashboardHero streak={streak} blockedToday={blockedCount} />}
            {progression && <FocusLevelCard progression={progression} compact />}

            <PageHeading
                eyebrow={today.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                })}
                title="Dashboard"
                description="See today’s progress, start the next useful action, and keep distractions blocked."
                actions={<StatusChip tone="success">Live sync</StatusChip>}
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                    label="Focuz score"
                    value={String(focusResult.score)}
                    accent={focusScoreColor(focusResult.score)}
                    hint={`${pomodoroToday} sessions today`}
                />
                <MetricCard label="Screen time" value={formatTime(todayTotal)} hint={isUp ? `↑ ${diffPercent}% vs yesterday` : `↓ ${diffPercent}% vs yesterday`} />
                <MetricCard label="Blocked" value={String(blockedCount)} accent="var(--fz-danger)" hint={focusActive ? 'Focus mode on' : 'Focus mode off'} />
                <MetricCard label="Streak" value={`${dashboardStreak}d`} accent="var(--fz-accent-warm)" hint={`${doneTasks}/${planner.length} tasks done`} />
            </div>

            <SectionCard
                title="Weekly activity"
                description={`${weekRangeLabel} · ${pomodoroToday} focus sessions today`}
                actions={
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label="Older week"
                            isDisabled={!canGoOlder}
                            onPress={() => setOffsetWeeks(offsetWeeks + 1)}
                        >
                            ‹
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label="Newer week"
                            isDisabled={offsetWeeks === 0}
                            onPress={() => setOffsetWeeks(Math.max(0, offsetWeeks - 1))}
                        >
                            ›
                        </Button>
                    </div>
                }
                contentClassName="space-y-3"
            >
                <div className="h-56 sm:h-64 md:h-72">
                    <ActivityGraph stats={weekStats} onSelectDay={setSelectedDay} />
                </div>
                <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--fz-text-tertiary)]">
                    {weekStats.map((s, i) => (
                        <span key={i}>{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    ))}
                </div>
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SectionCard
                    title="Tasks"
                    description={`${doneTasks}/${planner.length} complete`}
                    contentClassName="space-y-4"
                >
                    <div className="flex gap-2">
                        <Input
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void addPlanItem()}
                            placeholder="Add a task"
                            aria-label="New task"
                        />
                        <Button variant="primary" onPress={() => void addPlanItem()}>
                            Add
                        </Button>
                    </div>
                    <div className="min-h-[180px] space-y-1">
                        {planner.length === 0 ? (
                            <DashboardEmptyState
                                title="Nothing scheduled yet"
                                description="Add a quick task to decide what deserves your focus next."
                            />
                        ) : (
                            planner.map((p: { id: number; task: string; done: boolean }) => (
                                <div
                                    key={p.id}
                                    className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-[var(--fz-interactive)]"
                                >
                                    <Checkbox
                                        isSelected={p.done}
                                        onChange={() => void togglePlanItem(p.id)}
                                        aria-label={`${p.done ? 'Mark incomplete' : 'Mark complete'}: ${p.task}`}
                                    >
                                        <Checkbox.Control>
                                            <Checkbox.Indicator />
                                        </Checkbox.Control>
                                    </Checkbox>
                                    <span
                                        className={`min-w-0 flex-1 truncate text-sm ${
                                            p.done
                                                ? 'text-[var(--fz-text-tertiary)] line-through'
                                                : 'text-[var(--fz-text)]'
                                        }`}
                                    >
                                        {p.task}
                                    </span>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="ghost"
                                        aria-label={`Delete task: ${p.task}`}
                                        isDisabled={deletingTaskId !== null}
                                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                                        onPress={() => void deletePlanItem(p.id)}
                                    >
                                        <Trash2 size={15} aria-hidden="true" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </SectionCard>

                <SectionCard
                    title="Habits"
                    description={`${habits.length} active`}
                    actions={
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label="Older habit week"
                                onPress={() => setOffsetWeeks(offsetWeeks + 1)}
                            >
                                ‹
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label="Newer habit week"
                                isDisabled={offsetWeeks === 0}
                                onPress={() => setOffsetWeeks(Math.max(0, offsetWeeks - 1))}
                            >
                                ›
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                isIconOnly
                                aria-label="Add habit"
                                onPress={() => setHabitModalOpen(true)}
                            >
                                <Plus size={16} />
                            </Button>
                        </div>
                    }
                >
                    {habits.length === 0 ? (
                        <DashboardEmptyState
                            title="No habits yet"
                            description="Add a habit to track daily consistency."
                            action={
                                <Button size="sm" variant="secondary" onPress={() => setHabitModalOpen(true)}>
                                    Add habit
                                </Button>
                            }
                        />
                    ) : (
                        <div className="space-y-3">
                            {habits.slice(0, 5).map((h: { id: number; name: string; streak?: number; checkins?: string[] }) => (
                                <Card
                                    key={h.id}
                                    className="border border-[var(--fz-border)] bg-[var(--fz-surface-raised)] shadow-none"
                                >
                                    <Card.Content className="space-y-2 px-3 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium text-[var(--fz-text)]">{h.name}</span>
                                            <span className="text-xs font-semibold text-[var(--fz-text-secondary)]">
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
                                    </Card.Content>
                                </Card>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            <Modal state={dayDetailState}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="border border-[var(--fz-border-strong)] bg-[var(--fz-surface-raised)]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>
                                    {selectedDay
                                        ? new Date(selectedDay.date).toLocaleDateString('en-US', {
                                              weekday: 'long',
                                              month: 'long',
                                              day: 'numeric',
                                          })
                                        : 'Day details'}
                                </Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="space-y-4">
                                {selectedDay ? (
                                    <>
                                        <div>
                                            <p className="text-3xl font-semibold tabular-nums text-[var(--fz-text)]">
                                                {formatTime(selectedDay.total)}
                                            </p>
                                            <p className="text-xs text-[var(--fz-text-secondary)]">total screen time</p>
                                        </div>
                                        <div className="max-h-72 space-y-1 overflow-y-auto">
                                            {Object.entries(selectedDay.sites ?? {})
                                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                                .slice(0, 12)
                                                .map(([site, ms]) => (
                                                    <div
                                                        key={site}
                                                        className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--fz-interactive)]"
                                                    >
                                                        <img
                                                            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=32`}
                                                            alt=""
                                                            className="h-5 w-5 shrink-0 rounded"
                                                            loading="lazy"
                                                        />
                                                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--fz-text)]">
                                                            {site}
                                                        </span>
                                                        <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--fz-text-secondary)]">
                                                            {formatTime(ms as number)}
                                                        </span>
                                                    </div>
                                                ))}
                                            {Object.keys(selectedDay.sites ?? {}).length === 0 ? (
                                                <p className="py-8 text-center text-sm text-[var(--fz-text-tertiary)]">
                                                    No sites recorded that day.
                                                </p>
                                            ) : null}
                                        </div>
                                    </>
                                ) : null}
                            </Modal.Body>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            <HabitNameModal open={habitModalOpen} onClose={() => setHabitModalOpen(false)} onSubmit={addHabitByName} />
        </div>
    );
}

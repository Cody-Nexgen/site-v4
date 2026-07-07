import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../options/OptionsApp';
import { useAuthStore } from '../lib/store';
import { buildDailyActionPlan, getDailyGoal, setDailyGoal } from '../lib/dailyGoal';
import { writePomodoroRuntime } from '../lib/pomodoroRuntime';
import { Sparkles, Play, Wand2 } from 'lucide-react';

/** Suggests deep-work blocks from your daily goal and planner tasks. */
export default function DeepWorkPlanner() {
    const { engineState, fetchEngineState } = useAuthStore();
    const planner = engineState.dailyPlanner ?? [];
    const [goal, setGoal] = useState(getDailyGoal);
    const focusMin = engineState.pomodoroSettings?.focusMin ?? 25;

    useEffect(() => {
        setDailyGoal(goal);
    }, [goal]);

    const plan = useMemo(() => buildDailyActionPlan(goal, planner), [goal, planner]);

    const startBlock = async (_task: string, durationMin: number) => {
        const mins = durationMin || focusMin;
        await new Promise<void>((r) =>
            chrome.runtime.sendMessage(
                {
                    type: 'UPDATE_ENGINE_SETTINGS',
                    settings: {
                        pomodoroSettings: {
                            ...(engineState.pomodoroSettings ?? { focusMin: 25, breakMin: 5, sessionsCompleted: 0, lastDate: '' }),
                            focusMin: mins,
                        },
                    },
                },
                () => r(),
            ),
        );
        const sec = Math.round(mins * 60);
        await writePomodoroRuntime({
            running: true,
            paused: false,
            endAt: Date.now() + sec * 1000,
            timeLeftSec: sec,
            isBreak: false,
            segmentTotalSec: sec,
            focusMin: mins,
            breakMin: engineState.pomodoroSettings?.breakMin ?? 5,
        });
        fetchEngineState();
    };

    const openAiAutoSchedule = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'ai_coach');
        url.searchParams.set('coachPrompt', 'auto_schedule');
        window.history.replaceState({}, '', url.pathname + url.search);
        window.dispatchEvent(new CustomEvent('focuznow-navigate-tab', { detail: 'ai_coach' }));
    };

    return (
        <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-400" />
                    <h3 className="font-bold text-white text-sm">Deep Work Planner</h3>
                </div>
                <button
                    type="button"
                    onClick={openAiAutoSchedule}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white text-[10px] font-bold uppercase tracking-wide"
                >
                    <Wand2 size={11} />
                    Auto-schedule with AI
                </button>
            </div>
            <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What's your main goal today?"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 mb-4"
            />
            {plan.length === 0 ? (
                <p className="text-sm text-neutral-500 italic">Set a goal or add tasks to generate your action plan.</p>
            ) : (
                <div className="space-y-2">
                    {plan.map((item, i) => (
                        <div
                            key={`${item.time}-${item.task}-${i}`}
                            className="flex items-center justify-between gap-2 p-3 bg-white/[0.03] border border-white/5 rounded-xl group"
                        >
                            <div className="min-w-0">
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{item.time}</span>
                                <p className="text-sm font-bold text-white truncate">{item.task}</p>
                                <span className="text-[10px] text-neutral-500">{item.durationMin}m focus block</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => startBlock(item.task, item.durationMin || focusMin)}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Play size={10} fill="currentColor" />
                                Start
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </GlassCard>
    );
}

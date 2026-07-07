const GOAL_KEY = 'focuznow_daily_goal';

export function getDailyGoal(): string {
    try {
        return localStorage.getItem(GOAL_KEY) ?? '';
    } catch {
        return '';
    }
}

export function setDailyGoal(goal: string): void {
    try {
        localStorage.setItem(GOAL_KEY, goal);
    } catch {
        /* ignore */
    }
}

export type ActionPlanItem = {
    time: string;
    task: string;
    durationMin: number;
};

/** Turn a daily goal + pending tasks into a simple action plan. */
export function buildDailyActionPlan(
    goal: string,
    tasks: { task: string; done?: boolean; time?: string }[],
): ActionPlanItem[] {
    const pending = tasks.filter((t) => !t.done);
    const plan: ActionPlanItem[] = [];
    const slots = ['09:00', '10:30', '13:00', '15:00', '16:30'];
    let slotIdx = 0;

    if (goal.trim()) {
        plan.push({ time: slots[slotIdx++] ?? 'Anytime', task: `🎯 ${goal.trim()}`, durationMin: 45 });
    }

    for (const t of pending.slice(0, 4)) {
        plan.push({
            time: t.time && t.time !== 'Anytime' ? t.time : (slots[slotIdx++] ?? 'Anytime'),
            task: t.task,
            durationMin: 25,
        });
    }

    if (plan.length === 0 && goal.trim()) {
        plan.push({ time: '09:00', task: goal.trim(), durationMin: 25 });
    }

    return plan;
}

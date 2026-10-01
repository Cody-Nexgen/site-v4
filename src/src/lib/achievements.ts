export type Achievement = {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    /** How far along the requirement is (capped at target). */
    progress?: number;
    target?: number;
    /** Unit for progress, e.g. "days" → "2 of 3 days". */
    unit?: string;
};

export type AchievementInput = {
    streak: number;
    bestStreak: number;
    blockedToday: number;
    focusScore: number;
    habitsCount: number;
    pomodoroTotal?: number;
    tasksCompletedToday?: number;
};

type Definition = {
    id: string;
    title: string;
    description: string;
    icon: string;
    target: number;
    unit: string;
    value: (i: AchievementInput) => number;
};

const DEFINITIONS: Definition[] = [
    { id: 'first_focus', title: 'First step', description: 'Complete your first daily task', icon: '🎯', target: 1, unit: 'task', value: (i) => i.tasksCompletedToday ?? 0 },
    { id: 'streak_3', title: 'On a roll', description: 'Open the dashboard 3 days in a row', icon: '🔥', target: 3, unit: 'days', value: (i) => i.streak },
    { id: 'streak_7', title: 'Week warrior', description: 'Open the dashboard 7 days in a row', icon: '⚡', target: 7, unit: 'days', value: (i) => i.streak },
    { id: 'streak_30', title: 'Deep work grandmaster', description: 'Open the dashboard 30 days in a row', icon: '👑', target: 30, unit: 'days', value: (i) => i.streak },
    { id: 'blocker_10', title: 'Distraction shield', description: 'Block 10 distractions in one day', icon: '🛡️', target: 10, unit: 'blocks today', value: (i) => i.blockedToday },
    { id: 'focus_80', title: 'Flow state', description: 'Score 80+ on your focus score', icon: '✨', target: 80, unit: 'points', value: (i) => i.focusScore },
    { id: 'focus_95', title: 'Laser focus', description: 'Score 95+ on your focus score', icon: '💎', target: 95, unit: 'points', value: (i) => i.focusScore },
    { id: 'habits_3', title: 'Habit builder', description: 'Track 3 active habits', icon: '📈', target: 3, unit: 'habits', value: (i) => i.habitsCount },
    { id: 'pomodoro_5', title: 'Pomodoro pro', description: 'Complete 5 pomodoro sessions total', icon: '🍅', target: 5, unit: 'sessions', value: (i) => i.pomodoroTotal ?? 0 },
];

export function computeAchievements(input: AchievementInput): Achievement[] {
    return DEFINITIONS.map((def) => {
        const value = Math.max(0, def.value(input));
        return {
            id: def.id,
            title: def.title,
            description: def.description,
            icon: def.icon,
            unlocked: value >= def.target,
            progress: Math.min(value, def.target),
            target: def.target,
            unit: def.unit,
        };
    });
}

export function unlockedCount(achievements: Achievement[]): number {
    return achievements.filter((a) => a.unlocked).length;
}

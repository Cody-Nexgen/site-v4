export type Achievement = {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    progress?: number;
    target?: number;
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

const DEFINITIONS = [
    { id: 'first_focus', title: 'First Step', description: 'Complete your first daily task', icon: '🎯', check: (i: AchievementInput) => (i.tasksCompletedToday ?? 0) >= 1 },
    { id: 'streak_3', title: 'On a Roll', description: 'Open the dashboard 3 days in a row', icon: '🔥', check: (i: AchievementInput) => i.streak >= 3 },
    { id: 'streak_7', title: 'Week Warrior', description: 'Open the dashboard 7 days in a row', icon: '⚡', check: (i: AchievementInput) => i.streak >= 7 },
    { id: 'streak_30', title: 'Deep Work Grandmaster', description: 'Open the dashboard 30 days in a row', icon: '👑', check: (i: AchievementInput) => i.streak >= 30 },
    { id: 'blocker_10', title: 'Distraction Shield', description: 'Block 10 distractions in one day', icon: '🛡️', check: (i: AchievementInput) => i.blockedToday >= 10 },
    { id: 'focus_80', title: 'Flow State', description: 'Score 80+ on your focus score', icon: '✨', check: (i: AchievementInput) => i.focusScore >= 80 },
    { id: 'focus_95', title: 'Laser Focus', description: 'Score 95+ on your focus score', icon: '💎', check: (i: AchievementInput) => i.focusScore >= 95 },
    { id: 'habits_3', title: 'Habit Builder', description: 'Track 3 active habits', icon: '📈', check: (i: AchievementInput) => i.habitsCount >= 3 },
    { id: 'pomodoro_5', title: 'Pomodoro Pro', description: 'Complete 5 pomodoro sessions total', icon: '🍅', check: (i: AchievementInput) => (i.pomodoroTotal ?? 0) >= 5 },
] as const;

export function computeAchievements(input: AchievementInput): Achievement[] {
    return DEFINITIONS.map((def) => ({
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        unlocked: def.check(input),
        progress: def.id === 'streak_7' ? Math.min(input.streak, 7) : def.id === 'streak_30' ? Math.min(input.streak, 30) : undefined,
        target: def.id === 'streak_7' ? 7 : def.id === 'streak_30' ? 30 : undefined,
    }));
}

export function unlockedCount(achievements: Achievement[]): number {
    return achievements.filter((a) => a.unlocked).length;
}

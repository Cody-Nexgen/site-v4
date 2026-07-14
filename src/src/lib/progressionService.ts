import {
    awardProgressionEvent,
    loadProgressionState,
    saveProgressionState,
    tickPlatformStreak,
    type FocusProgressionState,
} from './focusProgression';
import { checkChallengeCompletions, pruneStaleActiveChallenges } from './challenges';
import { getAllChallengeDefinitions } from './dynamicChallenges';

let cachedFocusScore = 0;

export function setChallengeFocusScore(score: number) {
    cachedFocusScore = score;
}

async function runChallengeChecks(state: FocusProgressionState) {
    const pruned = pruneStaleActiveChallenges(state);
    const { state: next, completed } = checkChallengeCompletions(pruned, { focusScore: cachedFocusScore });
    if (completed.length === 0 && pruned === state) return;
    await saveProgressionState(next);
    try {
        chrome.runtime.sendMessage({
            type: 'PROGRESSION_UPDATED',
            state: next,
            challengesCompleted: completed.map((c) => c.id),
        }).catch(() => {});
    } catch {
        /* ignore */
    }
}

export async function onPomodoroComplete(focusMinutes = 25) {
    const today = new Date().toDateString();
    const { state } = await awardProgressionEvent('pomodoro_complete', {
        dedupKey: `pomodoro:${today}:${Date.now()}`,
        focusMinutes,
    });
    await runChallengeChecks(state);
}

export async function onBlockResisted() {
    const today = new Date().toDateString();
    const current = await loadProgressionState();
    const dayCount = current.awardedKeys.filter((k) => k.startsWith(`block_resisted:${today}:`)).length;
    const { state } = await awardProgressionEvent('block_resisted', {
        dedupKey: `block_resisted:${today}:${dayCount + 1}`,
    });
    await runChallengeChecks(state);
}

export async function onHabitCheckin(habitId: number) {
    const today = new Date().toDateString();
    const { state } = await awardProgressionEvent('habit_checkin', {
        dedupKey: `habit:${habitId}:${today}`,
    });
    await runChallengeChecks(state);
}

export async function onAchievementUnlock(achievementId: string) {
    const { state } = await awardProgressionEvent('achievement_unlock', {
        dedupKey: `achievement:${achievementId}`,
    });
    await runChallengeChecks(state);
}

export async function onDailyStreak(streakDays: number) {
    const today = new Date().toDateString();
    await awardProgressionEvent('daily_streak', {
        dedupKey: `daily_streak:${today}`,
        streakDays,
    });
}

export async function updatePlatformStreaks(inAppBlock?: {
    youtubeShorts?: boolean;
    tiktok?: boolean;
}) {
    let state = await loadProgressionState();
    state = tickPlatformStreak(state, 'shorts', !!inAppBlock?.youtubeShorts);
    state = tickPlatformStreak(state, 'tiktok', !!inAppBlock?.tiktok);
    await saveProgressionState(state);
    await runChallengeChecks(state);
}

export async function startChallengeById(
    challengeId: string,
    definition?: {
        id: string;
        title: string;
        description: string;
        icon: string;
        metric: string;
        target: number;
        xpReward: number;
        coinReward: number;
    },
) {
    const state = await loadProgressionState();
    const { startChallenge } = await import('./challenges');
    const def =
        (definition as import('./challenges').ChallengeDefinition | undefined) ??
        getAllChallengeDefinitions().find((d) => d.id === challengeId);
    if (!def) return state;
    const next = startChallenge(state, def);
    await saveProgressionState(next);
    try {
        chrome.runtime.sendMessage({ type: 'PROGRESSION_UPDATED', state: next }).catch(() => {});
    } catch {
        /* ignore */
    }
    return next;
}

export async function purchaseShopItem(itemId: string, cost: number) {
    const state = await loadProgressionState();
    const { purchaseCosmetic } = await import('./focusProgression');
    const result = purchaseCosmetic(state, itemId, cost);
    if (result.ok) await saveProgressionState(result.state);
    return result;
}

export async function equipShopItem(type: 'frame' | 'badge' | 'widget', itemId: string | null) {
    const state = await loadProgressionState();
    const { equipCosmetic } = await import('./focusProgression');
    const next = equipCosmetic(state, type, itemId);
    await saveProgressionState(next);
    return next;
}

export async function setPublicProfileEnabled(enabled: boolean) {
    const state = await loadProgressionState();
    const next = { ...state, publicProfileEnabled: enabled };
    await saveProgressionState(next);
    return next;
}

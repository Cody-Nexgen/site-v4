import {
    awardProgressionEvent,
    loadProgressionState,
    saveProgressionState,
    tickPlatformStreak,
    updateProgressionState,
    type FocusProgressionState,
} from './focusProgression';
import { checkChallengeCompletions, pruneStaleActiveChallenges } from './challenges';
import { getAllChallengeDefinitions } from './dynamicChallenges';

let cachedFocusScore = 0;
let hasCachedFocusScore = false;

export async function setChallengeFocusScore(score: number) {
    const nextScore = Number.isFinite(score) ? score : 0;
    if (hasCachedFocusScore && nextScore === cachedFocusScore) {
        return loadProgressionState();
    }
    cachedFocusScore = nextScore;
    hasCachedFocusScore = true;
    return runChallengeChecks();
}

async function runChallengeChecks(_state?: FocusProgressionState) {
    let completed: ReturnType<typeof checkChallengeCompletions>['completed'] = [];
    const next = await updateProgressionState((current) => {
        const pruned = pruneStaleActiveChallenges(current);
        const result = checkChallengeCompletions(pruned, { focusScore: cachedFocusScore });
        completed = result.completed;
        return result.state;
    });
    if (completed.length === 0) return next;
    try {
        chrome.runtime.sendMessage({
            type: 'PROGRESSION_UPDATED',
            state: next,
            challengesCompleted: completed.map((c) => c.id),
        }).catch(() => {});
    } catch {
        /* ignore */
    }
    return next;
}

export async function onPomodoroComplete(segmentId: string, focusMinutes = 25) {
    const { state } = await awardProgressionEvent('pomodoro_complete', {
        dedupKey: `pomodoro:segment:${segmentId}`,
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
        periodKind?: 'day' | 'week';
        periodKey?: string;
    },
) {
    const { startChallenge } = await import('./challenges');
    const def =
        (definition?.id === challengeId
            ? definition as import('./challenges').ChallengeDefinition
            : undefined) ??
        getAllChallengeDefinitions().find((d) => d.id === challengeId);
    if (!def) {
        const state = await loadProgressionState();
        return {
            state,
            started: false,
            active: false,
            persisted: false,
            reason: 'not_found' as const,
        };
    }
    let started = false;
    let reason: 'started' | 'already_active' | 'completed' = 'started';
    await updateProgressionState((state) => {
        if (state.completedChallenges.includes(challengeId)) {
            reason = 'completed';
            return state;
        }
        if (state.activeChallenges.some((challenge) => challenge.id === challengeId)) {
            reason = 'already_active';
            return state;
        }
        const updated = startChallenge(state, def);
        started = updated !== state;
        return updated;
    });
    // Reload after the queued write. The storage snapshot, not the in-memory
    // mutation result, is the authority returned across the message boundary.
    const persistedState = await loadProgressionState();
    const active = persistedState.activeChallenges.some((challenge) => challenge.id === challengeId);
    const completed = persistedState.completedChallenges.includes(challengeId);
    if (completed) reason = 'completed';
    else if (active && !started) reason = 'already_active';
    try {
        chrome.runtime.sendMessage({ type: 'PROGRESSION_UPDATED', state: persistedState }).catch(() => {});
    } catch {
        /* ignore */
    }
    return {
        state: persistedState,
        started,
        active,
        persisted: active,
        reason,
    };
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

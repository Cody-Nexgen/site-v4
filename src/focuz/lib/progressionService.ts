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
        const { upsertCloudChallenge } = await import('./challengeSync');
        await Promise.all(completed.map((c) => upsertCloudChallenge(c.id, 'completed')));
    } catch {
        /* offline / unauthenticated — local completion still stands */
    }
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
    let persistedState = await loadProgressionState();
    let active = persistedState.activeChallenges.some((challenge) => challenge.id === challengeId);
    let completed = persistedState.completedChallenges.includes(challengeId);
    if (completed) reason = 'completed';
    else if (active && !started) reason = 'already_active';

    // Persist the lifecycle to Supabase (source of truth). chrome.storage above is only the
    // fast local cache, so this durable write is what actually "fixes" a lost/evicted local
    // write: even if the storage read above raced and came back empty, the cloud confirmation
    // below lets the caller know the challenge really did start.
    const { upsertCloudChallenge, isChallengeConfirmedInCloud } = await import('./challengeSync');
    let cloudPersisted = false;
    if (completed) {
        cloudPersisted = await upsertCloudChallenge(challengeId, 'completed');
    } else if (active) {
        const snapshot = persistedState.activeChallenges.find((challenge) => challenge.id === challengeId);
        cloudPersisted = await upsertCloudChallenge(challengeId, 'active', snapshot ?? def);
    } else {
        // Local write did not stick. Fall back to the cloud before reporting failure, and
        // heal the local cache if the cloud already has it (e.g. a retried/duplicate call).
        const cloudState = await isChallengeConfirmedInCloud(challengeId);
        if (cloudState.completed) {
            completed = true;
            reason = 'completed';
            cloudPersisted = true;
        } else if (cloudState.active) {
            active = true;
            cloudPersisted = true;
            reason = started ? 'started' : 'already_active';
            persistedState = await updateProgressionState((state) => {
                if (state.activeChallenges.some((challenge) => challenge.id === challengeId)) return state;
                return startChallenge(state, def);
            });
        } else {
            // Neither local nor cloud has it yet — start it fresh in the cloud so a retry
            // (or the next hydrate) can recover even if local storage keeps failing.
            cloudPersisted = await upsertCloudChallenge(challengeId, 'active', def);
            if (cloudPersisted) {
                active = true;
                reason = 'started';
                persistedState = await updateProgressionState((state) => {
                    if (state.activeChallenges.some((challenge) => challenge.id === challengeId)) return state;
                    return startChallenge(state, def);
                });
            }
        }
    }

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
        cloudPersisted,
        reason,
    };
}

/**
 * Pull cloud challenge rows into the local cache. Called on session sync so a wiped/fresh
 * chrome.storage (new device, reinstalled extension) is repopulated from the durable source
 * of truth instead of silently losing in-progress/completed challenges.
 */
export async function hydrateChallengesFromCloud(): Promise<FocusProgressionState> {
    try {
        const { fetchCloudChallenges, mergeCloudChallengesIntoProgression } = await import('./challengeSync');
        const rows = await fetchCloudChallenges();
        if (rows.length === 0) return loadProgressionState();
        return updateProgressionState((state) => mergeCloudChallengesIntoProgression(state, rows));
    } catch {
        return loadProgressionState();
    }
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

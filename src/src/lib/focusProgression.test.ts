import { deepEqual, equal } from 'node:assert/strict';
import test from 'node:test';
import {
    PROGRESSION_STORAGE_KEY,
    awardProgressionEvent,
    defaultProgressionState,
    resetProgressionDerivedState,
} from './focusProgression';

test('concurrent completion attempts award one Pomodoro segment exactly once', async () => {
    const storage: Record<string, unknown> = {};
    Object.defineProperty(globalThis, 'chrome', {
        configurable: true,
        value: {
            storage: {
                local: {
                    get: async (key: string) => ({ [key]: storage[key] }),
                    set: async (values: Record<string, unknown>) => Object.assign(storage, values),
                },
            },
            runtime: {
                sendMessage: async () => undefined,
            },
        },
    });

    const results = await Promise.all(
        Array.from({ length: 20 }, () =>
            awardProgressionEvent('pomodoro_complete', {
                dedupKey: 'pomodoro:segment:stable-segment',
                focusMinutes: 25,
            }),
        ),
    );
    const state = storage[PROGRESSION_STORAGE_KEY] as ReturnType<typeof defaultProgressionState>;

    equal(results.filter((result) => result.award !== null).length, 1);
    equal(state.stats.totalPomodoros, 1);
    equal(state.stats.focusMinutesTotal, 25);
    deepEqual(state.awardedKeys, ['pomodoro:segment:stable-segment']);
});

test('progression repair clears derived awards while retaining challenge lifecycle', () => {
    const corrupted = defaultProgressionState();
    corrupted.xp = 999_999;
    corrupted.coins = 88_000;
    corrupted.stats.totalPomodoros = 1_267;
    corrupted.awardedKeys = ['pomodoro:segment:bad'];
    corrupted.completedChallenges = ['pomodoro-100'];
    corrupted.activeChallenges = [{
        id: 'deep-work',
        startedAt: '2026-07-14T12:00:00.000Z',
        title: 'Deep work',
        description: 'Focus',
        icon: '🧠',
        metric: 'focus_minutes',
        target: 30,
        baseline: 10,
        xpReward: 50,
        coinReward: 10,
    }];
    corrupted.ownedCosmetics = ['frame-carbon'];
    corrupted.equippedCosmetics = { frame: 'frame-carbon' };
    corrupted.publicProfileEnabled = true;

    const repaired = resetProgressionDerivedState(corrupted);

    equal(repaired.xp, 0);
    equal(repaired.coins, 0);
    equal(repaired.stats.totalPomodoros, 0);
    deepEqual(repaired.awardedKeys, []);
    deepEqual(repaired.completedChallenges, ['pomodoro-100']);
    deepEqual(repaired.activeChallenges, corrupted.activeChallenges);
    deepEqual(repaired.ownedCosmetics, ['frame-carbon']);
    deepEqual(repaired.equippedCosmetics, { frame: 'frame-carbon' });
    equal(repaired.publicProfileEnabled, true);
});

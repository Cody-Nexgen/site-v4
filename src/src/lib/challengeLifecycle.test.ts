import { deepEqual, equal, notEqual } from 'node:assert/strict';
import test from 'node:test';
import {
    checkChallengeCompletions,
    computeChallengeProgress,
    hasCompletedChallenge,
    hasPersistedChallengeStart,
    isChallengeStartResponseStaleOrPartial,
    startChallenge,
    type ChallengeDefinition,
} from './challenges';
import { generateDynamicChallenges } from './dynamicChallenges';
import {
    PROGRESSION_STORAGE_KEY,
    defaultProgressionState,
    loadProgressionState,
    saveProgressionState,
} from './focusProgression';
import { startChallengeById } from './progressionService';
import {
    scheduleChallengeFocusScore,
    sendProgressionMessage,
} from '../hooks/useFocusProgression';

function installChromeStorage() {
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
    return storage;
}

const focusMinutesChallenge: ChallengeDefinition = {
    id: 'test_focus_minutes',
    title: 'Focused test',
    description: 'Focus after starting',
    icon: '🧪',
    metric: 'focus_minutes',
    target: 30,
    xpReward: 50,
    coinReward: 10,
};

test('active challenge survives storage reload', async () => {
    installChromeStorage();
    const started = startChallenge(defaultProgressionState(), focusMinutesChallenge);

    await saveProgressionState(started);
    const reloaded = await loadProgressionState();

    equal(reloaded.activeChallenges.length, 1);
    equal(reloaded.activeChallenges[0]?.id, focusMinutesChallenge.id);
    equal(reloaded.activeChallenges[0]?.baseline, 0);
});

test('concurrent challenge starts are persisted idempotently', async () => {
    const storage = installChromeStorage();
    await saveProgressionState(defaultProgressionState());

    const results = await Promise.all(
        Array.from({ length: 12 }, () =>
            startChallengeById(focusMinutesChallenge.id, focusMinutesChallenge),
        ),
    );
    const persisted = storage[PROGRESSION_STORAGE_KEY] as ReturnType<typeof defaultProgressionState>;

    equal(results.filter((result) => result.started).length, 1);
    equal(results.every((result) => result.active), true);
    equal(persisted.activeChallenges.length, 1);
});

test('start response treats persisted progression as the contract authority', () => {
    const progression = startChallenge(defaultProgressionState(), focusMinutesChallenge);

    equal(hasPersistedChallengeStart({
        ok: false,
        active: false,
        persisted: false,
        started: false,
        progression,
    }, focusMinutesChallenge.id), true);
    equal(hasPersistedChallengeStart({
        ok: true,
        active: true,
        persisted: true,
        started: true,
        progression: defaultProgressionState(),
    }, focusMinutesChallenge.id), false);
});

test('start response contract detects stale shapes and completed authority', () => {
    const completed = defaultProgressionState();
    completed.completedChallenges.push(focusMinutesChallenge.id);
    const completeResponse = {
        ok: true,
        active: false,
        persisted: false,
        started: false,
        reason: 'completed',
        progression: completed,
    };

    equal(hasCompletedChallenge(completeResponse, focusMinutesChallenge.id), true);
    equal(isChallengeStartResponseStaleOrPartial(completeResponse, focusMinutesChallenge.id), false);
    equal(isChallengeStartResponseStaleOrPartial({
        ...completeResponse,
        persisted: true,
    }, focusMinutesChallenge.id), true);
    equal(isChallengeStartResponseStaleOrPartial({
        ok: false,
        error: 'The message port closed.',
    }, focusMinutesChallenge.id), true);
});

test('already-active and completed starts return distinct persisted contract states', async () => {
    installChromeStorage();
    await saveProgressionState(startChallenge(defaultProgressionState(), focusMinutesChallenge));

    const activeResult = await startChallengeById(focusMinutesChallenge.id, focusMinutesChallenge);
    equal(activeResult.started, false);
    equal(activeResult.active, true);
    equal(activeResult.persisted, true);
    equal(activeResult.reason, 'already_active');

    const completed = defaultProgressionState();
    completed.completedChallenges.push(focusMinutesChallenge.id);
    await saveProgressionState(completed);
    const completedResult = await startChallengeById(focusMinutesChallenge.id, focusMinutesChallenge);
    equal(completedResult.started, false);
    equal(completedResult.active, false);
    equal(completedResult.persisted, false);
    equal(completedResult.reason, 'completed');
});

test('dynamic challenge payload is persisted intact across the start boundary', async () => {
    installChromeStorage();
    await saveProgressionState(defaultProgressionState());
    const dynamic: ChallengeDefinition = {
        ...focusMinutesChallenge,
        id: 'dyn_test_contract',
        title: 'Dynamic contract',
        periodKind: 'week',
        periodKey: '2026-W29',
    };

    const result = await startChallengeById(dynamic.id, dynamic);
    const persisted = result.state.activeChallenges.find((challenge) => challenge.id === dynamic.id);

    equal(result.persisted, true);
    equal(persisted?.title, dynamic.title);
    equal(persisted?.periodKind, dynamic.periodKind);
    equal(persisted?.periodKey, dynamic.periodKey);
});

test('progression messages report timeout and closed-port errors explicitly', async () => {
    Object.defineProperty(globalThis, 'chrome', {
        configurable: true,
        value: {
            runtime: {
                lastError: undefined,
                sendMessage: () => undefined,
            },
        },
    });
    const timedOut = await sendProgressionMessage({ type: 'TEST_TIMEOUT' }, { timeoutMs: 10 });
    equal(timedOut.ok, false);
    equal(timedOut.code, 'timeout');

    globalThis.chrome.runtime.sendMessage = ((_message: unknown, callback: (response?: unknown) => void) => {
        Object.defineProperty(globalThis.chrome.runtime, 'lastError', {
            configurable: true,
            value: { message: 'The message port closed.' },
        });
        callback();
        Object.defineProperty(globalThis.chrome.runtime, 'lastError', {
            configurable: true,
            value: undefined,
        });
    }) as typeof chrome.runtime.sendMessage;
    const portError = await sendProgressionMessage({ type: 'TEST_PORT' });
    equal(portError.ok, false);
    equal(portError.code, 'port_error');
    equal(portError.error, 'The message port closed.');
});

test('focus-score messaging is trailing-edge debounced', async () => {
    let sent = 0;
    Object.defineProperty(globalThis, 'chrome', {
        configurable: true,
        value: {
            runtime: {
                lastError: undefined,
                sendMessage: (_message: unknown, callback: (response: unknown) => void) => {
                    sent += 1;
                    callback({ ok: true });
                },
            },
        },
    });

    scheduleChallengeFocusScore(10, 15);
    scheduleChallengeFocusScore(20, 15);
    scheduleChallengeFocusScore(30, 15);
    await new Promise((resolve) => setTimeout(resolve, 40));

    equal(sent, 1);
});

test('challenge progress uses its start baseline and completion is final', () => {
    const initial = defaultProgressionState();
    initial.stats.focusMinutesTotal = 100;
    const state = startChallenge(initial, focusMinutesChallenge);
    state.stats.focusMinutesTotal = 129;

    equal(computeChallengeProgress(state).find((item) => item.id === focusMinutesChallenge.id)?.current, 29);

    state.stats.focusMinutesTotal = 130;
    const result = checkChallengeCompletions(state);

    deepEqual(result.state.activeChallenges, []);
    deepEqual(result.state.completedChallenges, [focusMinutesChallenge.id]);
    equal(result.completed.length, 1);
    equal(startChallenge(result.state, focusMinutesChallenge), result.state);
});

test('focus score participates in progress and completion checks', () => {
    const scoreChallenge: ChallengeDefinition = {
        ...focusMinutesChallenge,
        id: 'test_focus_score',
        metric: 'focus_score',
        target: 70,
    };
    const state = startChallenge(defaultProgressionState(), scoreChallenge);

    equal(
        computeChallengeProgress(state, undefined, { focusScore: 69 })
            .find((item) => item.id === scoreChallenge.id)?.current,
        69,
    );
    equal(checkChallengeCompletions(state, { focusScore: 70 }).completed[0]?.id, scoreChallenge.id);
});

test('dynamic period definitions are stable for an injected date', () => {
    const progression = defaultProgressionState();
    progression.stats.weekPomodorosCount = 4;
    const input = {
        progression,
        dashboardStreak: 2,
        focusScore: 20,
        habitsCount: 1,
        now: new Date(2026, 6, 14, 23, 59),
    };

    const first = generateDynamicChallenges(input);
    progression.stats.weekPomodorosCount = 99;
    const second = generateDynamicChallenges(input);
    const nextDay = generateDynamicChallenges({
        ...input,
        now: new Date(2026, 6, 15, 0, 1),
    });

    deepEqual(first, second);
    notEqual(
        first.find((item) => item.id.startsWith('dyn_streak_hold_'))?.id,
        nextDay.find((item) => item.id.startsWith('dyn_streak_hold_'))?.id,
    );
});

test('period challenges ignore stale counters and expire deterministically', () => {
    const now = new Date();
    const progression = defaultProgressionState();
    progression.stats.weekPomodorosKey = 'stale-week';
    progression.stats.weekPomodorosCount = 99;
    const input = {
        progression,
        dashboardStreak: 0,
        focusScore: 100,
        habitsCount: 0,
        now,
    };
    const weekly = generateDynamicChallenges(input)
        .find((item) => item.id.startsWith('dyn_week_pomo_'));
    if (!weekly) throw new Error('Expected weekly challenge');

    const started = startChallenge(progression, weekly);
    equal(started.activeChallenges[0]?.baseline, 0);

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const visible = computeChallengeProgress(started, { ...input, now: nextWeek });
    equal(visible.some((item) => item.id === weekly.id && item.active), false);
});

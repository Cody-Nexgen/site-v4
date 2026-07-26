import { deepEqual, equal, match } from 'node:assert/strict';
import test from 'node:test';
import {
    appendFutureSelfEvent,
    createContract,
    emptyFutureSelfState,
    normalizeDestination,
    validateContractInput,
} from './futureSelfContract';
import {
    createDailyMirror,
    ensureMirrorForPreviousDay,
    summarizeActiveContract,
} from './futureSelfMirror';
import type { FutureSelfState } from './futureSelfTypes';

test('normalizes entered work destinations and validates contracts', () => {
    const destination = normalizeDestination('docs.example.com/project', 'Project');
    equal(destination.domain, 'docs.example.com');
    match(destination.url, /^https:\/\/docs\.example\.com/);
    equal(validateContractInput({
        mission: 'Write proposal',
        overarchingGoal: 'Launch the company',
        futureTargetDate: '2099-12-31',
        plannedMinutesPerDay: 60,
        destination,
    }), null);
});

test('focus completion event is idempotent per segment', () => {
    const contract = createContract({
        mission: 'Write',
        overarchingGoal: 'Publish',
        futureTargetDate: '2099-12-31',
        plannedMinutesPerDay: 25,
        destination: normalizeDestination('example.com'),
    }, 100);
    const state = { ...emptyFutureSelfState(), activeContract: contract, contracts: [contract] };
    const once = appendFutureSelfEvent(state, {
        contractId: contract.id,
        type: 'focus_completed',
        timestamp: 200,
        minutes: 25,
        segmentId: 'stable-segment',
    });
    const twice = appendFutureSelfEvent(once, {
        contractId: contract.id,
        type: 'focus_completed',
        timestamp: 300,
        minutes: 25,
        segmentId: 'stable-segment',
    });
    equal(twice.events.length, 1);
});

test('summaries and daily mirrors are deterministic and generated once', () => {
    const now = new Date(2026, 6, 15, 12).getTime();
    const yesterday = new Date(2026, 6, 14, 10).getTime();
    const contract = createContract({
        mission: 'Ship feature',
        overarchingGoal: 'Build a focused product',
        futureTargetDate: '2026-12-31',
        plannedMinutesPerDay: 50,
        destination: normalizeDestination('github.com'),
    }, yesterday);
    let state: FutureSelfState = {
        ...emptyFutureSelfState(),
        activeContract: contract,
        contracts: [contract],
    };
    state = appendFutureSelfEvent(state, {
        contractId: contract.id,
        type: 'focus_completed',
        timestamp: yesterday,
        minutes: 25,
        segmentId: 'one',
    });
    state = appendFutureSelfEvent(state, {
        contractId: contract.id,
        type: 'blocked',
        timestamp: yesterday + 100,
        domain: 'social.example',
    });
    const mirror = createDailyMirror(state, '2026-07-14', now);
    equal(mirror?.completedMinutes, 25);
    equal(mirror?.biggestDistraction, 'social.example');
    equal(mirror?.projectedDelayDays, 1);

    const generated = ensureMirrorForPreviousDay(state, now);
    const repeated = ensureMirrorForPreviousDay(generated, now);
    equal(generated.mirrors.length, 1);
    deepEqual(repeated.mirrors, generated.mirrors);
    equal(summarizeActiveContract(state)?.remainingMinutes, 50);
});

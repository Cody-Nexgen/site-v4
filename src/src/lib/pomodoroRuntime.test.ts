import { deepEqual } from 'node:assert/strict';
import test from 'node:test';
import { createResetPomodoroRuntime } from './pomodoroRuntime';

test('reset runtime uses the newly selected focus duration', () => {
    deepEqual(createResetPomodoroRuntime(50, 10), {
        running: false,
        paused: false,
        endAt: null,
        timeLeftSec: 3000,
        isBreak: false,
        segmentTotalSec: 3000,
        focusMin: 50,
        breakMin: 10,
    });
});

test('reset runtime uses the selected break duration for a break', () => {
    const runtime = createResetPomodoroRuntime(50, 10, true);
    deepEqual(
        { timeLeftSec: runtime.timeLeftSec, segmentTotalSec: runtime.segmentTotalSec },
        { timeLeftSec: 600, segmentTotalSec: 600 },
    );
});

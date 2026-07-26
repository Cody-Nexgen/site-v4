// Background pomodoro — alarms, notifications, auto break after focus.

import { updateEngineSettings, getEngineState } from './blockengine.js';
import { plantTreeFromSession } from '../lib/forest';
import { onPomodoroComplete } from '../lib/progressionService';
import {
    PROGRESSION_STORAGE_KEY,
    resetProgressionDerivedState,
    saveProgressionState,
} from '../lib/focusProgression';
import { finishFutureSelfContract, recordFutureSelfEvent } from './futureSelfService.js';

export const POMODORO_RUNTIME_KEY = 'pomodoroRuntimeV1';
export const POMODORO_ALARM_NAME = 'pomodoro-segment-end';
export const POMODORO_REPAIR_KEY = 'pomodoroProgressionRepairV1';
const AWARDED_ACHIEVEMENTS_KEY = 'focuznow_awarded_achievements';

let completionQueue = Promise.resolve();

function newSegmentId() {
    return globalThis.crypto?.randomUUID?.() ??
        `segment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function computeTimeLeft(rt) {
    if (!rt || rt.paused || !rt.running || !rt.endAt) return rt?.timeLeftSec ?? 0;
    return Math.max(0, Math.ceil((rt.endAt - Date.now()) / 1000));
}

async function scheduleAlarm(endAt) {
    await chrome.alarms.clear(POMODORO_ALARM_NAME);
    if (endAt && endAt > Date.now()) {
        chrome.alarms.create(POMODORO_ALARM_NAME, { when: endAt });
    }
}

async function readRuntime() {
    const r = await chrome.storage.local.get(POMODORO_RUNTIME_KEY);
    return r[POMODORO_RUNTIME_KEY] || null;
}

async function syncAlarmForRuntime(rt) {
    if (rt?.running && !rt.paused && rt.endAt) {
        await scheduleAlarm(rt.endAt);
    } else {
        await chrome.alarms.clear(POMODORO_ALARM_NAME);
    }
}

async function writeRuntime(rt) {
    if (!rt) {
        await chrome.storage.local.remove(POMODORO_RUNTIME_KEY);
        await chrome.alarms.clear(POMODORO_ALARM_NAME);
        return;
    }
    await chrome.storage.local.set({ [POMODORO_RUNTIME_KEY]: rt });
    await syncAlarmForRuntime(rt);
}

async function ensureSegmentId(rt) {
    if (rt.segmentId) return rt;
    const next = { ...rt, segmentId: newSegmentId() };
    await writeRuntime(next);
    return next;
}

function notify(title, message) {
    try {
        chrome.notifications.create(`pomo-${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
            title,
            message,
            priority: 2,
        });
    } catch (e) {
        console.warn('[Pomodoro] notification failed', e);
    }
}

async function runOneTimeProgressionRepair() {
    const stored = await chrome.storage.local.get([
        POMODORO_REPAIR_KEY,
        PROGRESSION_STORAGE_KEY,
        AWARDED_ACHIEVEMENTS_KEY,
    ]);
    if (stored[POMODORO_REPAIR_KEY] === true) return;

    await saveProgressionState(resetProgressionDerivedState(stored[PROGRESSION_STORAGE_KEY]));
    const awardedAchievements = Array.isArray(stored[AWARDED_ACHIEVEMENTS_KEY])
        ? stored[AWARDED_ACHIEVEMENTS_KEY].filter((id) => id !== 'pomodoro_5')
        : [];
    await chrome.storage.local.set({
        [AWARDED_ACHIEVEMENTS_KEY]: awardedAchievements,
    });

    const settings = getEngineState().pomodoroSettings || {
        focusMin: 25,
        breakMin: 5,
    };
    await updateEngineSettings({
        pomodoroSettings: {
            ...settings,
            sessionsCompleted: 0,
            lastDate: '',
            lastCompletedSegmentId: '',
        },
    });
    await chrome.storage.local.set({ [POMODORO_REPAIR_KEY]: true });
}

async function processSegmentComplete() {
    let rt = await readRuntime();
    if (!rt || !rt.running) return;
    if (computeTimeLeft(rt) > 0) return;
    rt = await ensureSegmentId(rt);
    if (rt.completingSegmentId !== rt.segmentId) {
        rt = { ...rt, completingSegmentId: rt.segmentId };
        await writeRuntime(rt);
    }

    const settings = getEngineState().pomodoroSettings || {
        focusMin: 25,
        breakMin: 5,
        sessionsCompleted: 0,
        lastDate: '',
    };

    if (!rt.isBreak) {
        const isNewCompletion = settings.lastCompletedSegmentId !== rt.segmentId;
        if (isNewCompletion) {
            const today = new Date().toDateString();
            const updated = {
                ...settings,
                sessionsCompleted:
                    settings.lastDate === today
                        ? (settings.sessionsCompleted || 0) + 1
                        : 1,
                lastDate: today,
                lastCompletedSegmentId: rt.segmentId,
            };
            await updateEngineSettings({ pomodoroSettings: updated });
        }

        // Forest: a completed focus session plants a tree
        if (isNewCompletion) {
            await plantTreeFromSession().catch((e) => console.warn('[Forest] plant failed', e));
        }

        const focusMin = rt.focusMin || settings.focusMin || 25;
        await onPomodoroComplete(rt.segmentId, focusMin);
        if (rt.futureSelfContractId) {
            await recordFutureSelfEvent('focus_completed', {
                minutes: focusMin,
                segmentId: rt.segmentId,
            });
            await recordFutureSelfEvent('break_started', {
                segmentId: `break-${rt.segmentId}`,
            });
            await finishFutureSelfContract('completed');
        }

        if (isNewCompletion) {
            await import('../lib/socialHeartbeat.js')
                .then(({ sendSocialHeartbeat }) =>
                    sendSocialHeartbeat({ focusing: false, focusMinutesDelta: focusMin }),
                )
                .catch(() => {});
        }

        const breakMin = rt.breakMin || settings.breakMin || 5;
        const breakSec = Math.round(breakMin * 60);
        const endAt = Date.now() + breakSec * 1000;
        const next = {
            ...rt,
            running: true,
            paused: false,
            isBreak: true,
            timeLeftSec: breakSec,
            segmentTotalSec: breakSec,
            endAt,
            segmentId: newSegmentId(),
            completingSegmentId: null,
        };
        await writeRuntime(next);
        const breakLabel = breakMin < 1 ? `${breakSec}s` : `${breakMin} minute${breakMin === 1 ? '' : 's'}`;
        notify(
            'Focus session complete! 🎉',
            `Nice work. Starting ${breakLabel} break now.`,
        );
    } else {
        const focusMin = rt.focusMin || settings.focusMin || 25;
        const focusSec = Math.round(focusMin * 60);
        const next = {
            ...rt,
            running: false,
            paused: false,
            isBreak: false,
            timeLeftSec: focusSec,
            segmentTotalSec: focusSec,
            endAt: null,
            segmentId: newSegmentId(),
            completingSegmentId: null,
        };
        await writeRuntime(next);
        notify('Break over ⏰', `Ready for your next ${focusMin}-minute focus session. Let's go!`);
    }

    try {
        chrome.runtime.sendMessage({ type: 'POMODORO_SEGMENT_DONE' }).catch(() => {});
    } catch {
        /* no listeners */
    }
}

async function onSegmentComplete() {
    const operation = completionQueue.then(processSegmentComplete, processSegmentComplete);
    completionQueue = operation.catch(() => {});
    return operation;
}

export async function completePomodoroSegment() {
    const rt = await readRuntime();
    if (!rt?.running) return { ok: false };
    const left = computeTimeLeft(rt);
    if (left > 0) return { ok: false, timeLeft: left };
    await onSegmentComplete();
    return { ok: true };
}

export async function initPomodoro() {
    await runOneTimeProgressionRepair();

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === POMODORO_ALARM_NAME) {
            void onSegmentComplete();
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes[POMODORO_RUNTIME_KEY]) return;
        const rt = changes[POMODORO_RUNTIME_KEY].newValue;
        if (rt && !rt.segmentId) {
            void ensureSegmentId(rt);
        } else {
            void syncAlarmForRuntime(rt || null);
        }
    });

    let rt = await readRuntime();
    if (rt) {
        rt = await ensureSegmentId(rt);
    }
    if (rt?.running && !rt.paused && rt.endAt) {
        const left = computeTimeLeft(rt);
        if (left <= 0) {
            await onSegmentComplete();
        } else {
            await scheduleAlarm(rt.endAt);
        }
    }
}

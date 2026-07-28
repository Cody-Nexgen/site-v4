/** Persisted pomodoro timer — survives leaving Sessions tab and extension restarts. */

export const POMODORO_RUNTIME_KEY = 'pomodoroRuntimeV1';
export const POMODORO_ALARM_NAME = 'pomodoro-segment-end';

export type PomodoroRuntime = {
    running: boolean;
    paused: boolean;
    endAt: number | null;
    timeLeftSec: number;
    isBreak: boolean;
    segmentTotalSec: number;
    focusMin: number;
    breakMin: number;
    segmentId?: string;
    futureSelfContractId?: string;
};

export function computeTimeLeft(rt: PomodoroRuntime): number {
    if (rt.paused || !rt.running || !rt.endAt) return rt.timeLeftSec;
    return Math.max(0, Math.ceil((rt.endAt - Date.now()) / 1000));
}

export function createResetPomodoroRuntime(
    focusMin: number,
    breakMin: number,
    isBreak = false,
): PomodoroRuntime {
    const segmentTotalSec = Math.round((isBreak ? breakMin : focusMin) * 60);
    return {
        running: false,
        paused: false,
        endAt: null,
        timeLeftSec: segmentTotalSec,
        isBreak,
        segmentTotalSec,
        focusMin,
        breakMin,
    };
}

export async function readPomodoroRuntime(): Promise<PomodoroRuntime | null> {
    const r = await chrome.storage.local.get(POMODORO_RUNTIME_KEY);
    const v = r[POMODORO_RUNTIME_KEY] as PomodoroRuntime | undefined;
    return v && typeof v.timeLeftSec === 'number' ? v : null;
}

export async function writePomodoroRuntime(rt: PomodoroRuntime | null): Promise<void> {
    if (!rt) {
        await chrome.storage.local.remove(POMODORO_RUNTIME_KEY);
        chrome.runtime
            .sendMessage({ type: 'SOCIAL_HEARTBEAT', focusing: false })
            .catch(() => {});
        return;
    }
    await chrome.storage.local.set({ [POMODORO_RUNTIME_KEY]: rt });
    if (rt.running && !rt.paused && !rt.isBreak && rt.endAt) {
        chrome.runtime
            .sendMessage({
                type: 'SOCIAL_HEARTBEAT',
                focusing: true,
                endsAt: new Date(rt.endAt).toISOString(),
            })
            .catch(() => {});
    } else {
        chrome.runtime
            .sendMessage({ type: 'SOCIAL_HEARTBEAT', focusing: false })
            .catch(() => {});
    }
}

/**
 * Advance a finished segment locally (focus → break, or break → idle).
 * Used by the web app (and as a fallback) when the extension SW cannot see
 * this page's storage — otherwise the UI sticks at 00:00.
 */
export async function completePomodoroSegmentLocal(
    rt?: PomodoroRuntime | null,
): Promise<PomodoroRuntime | null> {
    const current = rt ?? (await readPomodoroRuntime());
    if (!current?.running) return current;
    if (computeTimeLeft(current) > 0) return current;

    const focusMin = current.focusMin || 25;
    const breakMin = current.breakMin || 5;
    const nextId =
        globalThis.crypto?.randomUUID?.() ?? `segment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let next: PomodoroRuntime;
    if (!current.isBreak) {
        const breakSec = Math.max(1, Math.round(breakMin * 60));
        next = {
            ...current,
            running: true,
            paused: false,
            isBreak: true,
            timeLeftSec: breakSec,
            segmentTotalSec: breakSec,
            endAt: Date.now() + breakSec * 1000,
            segmentId: nextId,
        };
    } else {
        const focusSec = Math.max(1, Math.round(focusMin * 60));
        next = {
            ...current,
            running: false,
            paused: false,
            isBreak: false,
            timeLeftSec: focusSec,
            segmentTotalSec: focusSec,
            endAt: null,
            segmentId: nextId,
        };
    }
    await writePomodoroRuntime(next);
    return next;
}

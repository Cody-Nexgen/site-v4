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
};

export function computeTimeLeft(rt: PomodoroRuntime): number {
    if (rt.paused || !rt.running || !rt.endAt) return rt.timeLeftSec;
    return Math.max(0, Math.ceil((rt.endAt - Date.now()) / 1000));
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

// =========================================================
// devMode.ts — hidden developer testing mode
//
// Toggled by typing /devmodetest in the command palette.
// When enabled, feature tabs may expose testing tools
// (e.g. the Forest dev toolkit: unlimited planting, instant
// growth, slips, resets) without a dev build.
// =========================================================

export const DEV_MODE_KEY = 'focuznow-dev-mode';
export const DEV_MODE_EVENT = 'focuznow-devmode-changed';

export function isDevModeEnabled(): boolean {
    try {
        return localStorage.getItem(DEV_MODE_KEY) === '1';
    } catch {
        return false;
    }
}

export function setDevModeEnabled(on: boolean): void {
    try {
        if (on) localStorage.setItem(DEV_MODE_KEY, '1');
        else localStorage.removeItem(DEV_MODE_KEY);
        window.dispatchEvent(new CustomEvent(DEV_MODE_EVENT, { detail: { enabled: on } }));
    } catch {
        /* storage unavailable */
    }
}

export function toggleDevMode(): boolean {
    const next = !isDevModeEnabled();
    setDevModeEnabled(next);
    return next;
}

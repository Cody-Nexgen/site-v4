import { useAuthStore } from './store';

export const PRO_DASHBOARD_SETTING_KEY = 'proDashboardVisuals';
export const FOCUS_COMPLETE_EVENT = 'focuznow-focus-complete';
export const PRO_CONFETTI_SESSION_KEY = 'focuznow_pro_confetti_week';

export function shouldShowProConfetti(): boolean {
    try {
        const week = new Date();
        week.setHours(0, 0, 0, 0);
        const weekId = `${week.getFullYear()}-W${Math.ceil(
            ((week.getTime() - new Date(week.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
        )}`;
        const params = new URLSearchParams(window.location.search);
        const fromCheckout = params.get('subscription') === 'success';
        const last = sessionStorage.getItem(PRO_CONFETTI_SESSION_KEY);
        if (fromCheckout || last !== weekId) {
            sessionStorage.setItem(PRO_CONFETTI_SESSION_KEY, weekId);
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

export function dispatchFocusComplete() {
    window.dispatchEvent(new CustomEvent(FOCUS_COMPLETE_EVENT));
}

/**
 * Motion/polish visuals — now enabled for every user (Pro Gold deleted).
 * `setEnabled` is retained as the "Reduce motion" switch in Settings:
 * `enabled=false` means reduce motion.
 */
export function useVisuals() {
    const { subscriptionTier, engineState, fetchEngineState } = useAuthStore();
    const isPro = subscriptionTier === 'pro';
    // `proDashboardVisuals === false` is the stored "reduce motion" opt-out.
    const enabled = engineState.proDashboardVisuals !== false;

    const setEnabled = async (next: boolean) => {
        await new Promise<void>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { proDashboardVisuals: next } },
                () => resolve(),
            ),
        );
        await fetchEngineState();
    };

    // Gold theme is deleted — these stay false so old call sites take the neutral branch.
    return { isPro, enabled, setEnabled, proTheme: false, proGoldTheme: false };
}

/** @deprecated use useVisuals — same shape, enabled is now universal. */
export const useProDashboardVisuals = useVisuals;

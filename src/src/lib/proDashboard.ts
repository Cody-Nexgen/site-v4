import { useAuthStore, type EngineState } from './store';
import {
    isProGoldThemeActive,
    isProMotionEnabled,
    isProThemeActive,
    PRO_GOLD_THEME_ID,
    PRO_THEME_ID,
} from './themes';

export const PRO_DASHBOARD_SETTING_KEY = 'proDashboardVisuals';
export const FOCUS_COMPLETE_EVENT = 'focuznow-focus-complete';
export const PRO_CONFETTI_SESSION_KEY = 'focuznow_pro_confetti_week';

export { PRO_THEME_ID, PRO_GOLD_THEME_ID, isProThemeActive, isProGoldThemeActive, isProMotionEnabled };

/** @deprecated use isProMotionEnabled */
export function isProDashboardVisualsEnabled(
    engineState: Pick<EngineState, 'theme'> & { proDashboardVisuals?: boolean },
    isPro: boolean,
): boolean {
    return isProMotionEnabled(engineState, isPro);
}

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

export function useProDashboardVisuals() {
    const { subscriptionTier, engineState, fetchEngineState } = useAuthStore();
    const isPro = subscriptionTier === 'pro';
    const proTheme = isProThemeActive(engineState, isPro);
    const proGoldTheme = isProGoldThemeActive(engineState, isPro);
    const enabled = isProMotionEnabled(engineState, isPro);

    const setEnabled = async (next: boolean) => {
        await new Promise<void>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { proDashboardVisuals: next } },
                () => resolve(),
            ),
        );
        await fetchEngineState();
    };

    return { isPro, proTheme, proGoldTheme, enabled, setEnabled };
}

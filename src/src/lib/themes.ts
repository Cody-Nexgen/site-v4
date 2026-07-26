import type { EngineState } from './store';

export const PRO_GOLD_THEME_ID = 'pro' as const;
export const CUSTOM_THEME_ID = 'custom' as const;
export const DASHBOARD_COLOR_MODE_KEY = 'dashboardColorMode' as const;
const DASHBOARD_COLOR_MODE_CACHE_KEY = 'focuznow-dashboard-color-mode-v1';

export type DashboardColorMode = 'light' | 'dark' | 'system';
export type ResolvedDashboardColorMode = Exclude<DashboardColorMode, 'system'>;

const dashboardColorModes: DashboardColorMode[] = ['light', 'dark', 'system'];
let dashboardMode: DashboardColorMode = 'system';
let dashboardModeInitialized = false;
let mediaQuery: MediaQueryList | null = null;
const dashboardModeListeners = new Set<(mode: DashboardColorMode) => void>();

function isDashboardColorMode(value: unknown): value is DashboardColorMode {
    return typeof value === 'string' && dashboardColorModes.includes(value as DashboardColorMode);
}

function readCachedDashboardColorMode(): DashboardColorMode {
    try {
        const cached = window.localStorage.getItem(DASHBOARD_COLOR_MODE_CACHE_KEY);
        return isDashboardColorMode(cached) ? cached : 'system';
    } catch {
        return 'system';
    }
}

export function getDashboardColorMode(): DashboardColorMode {
    if (!dashboardModeInitialized) dashboardMode = readCachedDashboardColorMode();
    return dashboardMode;
}

export function resolveDashboardColorMode(
    mode: DashboardColorMode,
): ResolvedDashboardColorMode {
    if (mode !== 'system') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyDashboardColorMode(mode: DashboardColorMode) {
    dashboardMode = mode;
    const resolved = resolveDashboardColorMode(mode);
    const root = document.documentElement;
    root.dataset.dashboardColorMode = mode;
    root.dataset.dashboardTheme = resolved;
    root.style.colorScheme = resolved;
    root.classList.toggle('light-theme', resolved === 'light');
    root.classList.toggle('dark-theme', resolved === 'dark');
    root.classList.toggle('dark', resolved === 'dark');
    if (document.body) {
        document.body.dataset.dashboardTheme = resolved;
        document.body.style.colorScheme = resolved;
    }
}

function notifyDashboardModeListeners() {
    dashboardModeListeners.forEach((listener) => listener(dashboardMode));
}

function cacheDashboardColorMode(mode: DashboardColorMode) {
    try {
        window.localStorage.setItem(DASHBOARD_COLOR_MODE_CACHE_KEY, mode);
    } catch {
        // chrome.storage remains the canonical persisted value.
    }
}

export async function initializeDashboardColorMode(): Promise<DashboardColorMode> {
    if (!dashboardModeInitialized) {
        dashboardModeInitialized = true;
        dashboardMode = readCachedDashboardColorMode();
        applyDashboardColorMode(dashboardMode);

        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
            if (dashboardMode === 'system') applyDashboardColorMode('system');
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;
            const next = changes[DASHBOARD_COLOR_MODE_KEY]?.newValue;
            if (!isDashboardColorMode(next) || next === dashboardMode) return;
            dashboardMode = next;
            cacheDashboardColorMode(next);
            applyDashboardColorMode(next);
            notifyDashboardModeListeners();
        });
    }

    try {
        const stored = await chrome.storage.local.get([DASHBOARD_COLOR_MODE_KEY, 'theme']);
        const persisted = isDashboardColorMode(stored[DASHBOARD_COLOR_MODE_KEY])
            ? stored[DASHBOARD_COLOR_MODE_KEY]
            : isDashboardColorMode(stored.theme)
                ? stored.theme
                : dashboardMode;
        if (persisted !== dashboardMode) {
            dashboardMode = persisted;
            cacheDashboardColorMode(persisted);
            applyDashboardColorMode(persisted);
            notifyDashboardModeListeners();
        }
        if (!isDashboardColorMode(stored[DASHBOARD_COLOR_MODE_KEY])) {
            await chrome.storage.local.set({ [DASHBOARD_COLOR_MODE_KEY]: persisted });
        }
    } catch {
        // Keep the synchronously cached mode if extension storage is unavailable.
    }
    return dashboardMode;
}

export async function setDashboardColorMode(mode: DashboardColorMode) {
    dashboardMode = mode;
    cacheDashboardColorMode(mode);
    applyDashboardColorMode(mode);
    notifyDashboardModeListeners();
    await chrome.storage.local.set({ [DASHBOARD_COLOR_MODE_KEY]: mode });
}

export function subscribeToDashboardColorMode(
    listener: (mode: DashboardColorMode) => void,
) {
    dashboardModeListeners.add(listener);
    return () => {
        dashboardModeListeners.delete(listener);
    };
}

/** @deprecated use PRO_GOLD_THEME_ID */
export const PRO_THEME_ID = PRO_GOLD_THEME_ID;

export const PUBLIC_THEME_IDS = ['purple', 'emerald', 'amber', 'rose'] as const;

export const PRO_EXCLUSIVE_THEME_IDS = [PRO_GOLD_THEME_ID, CUSTOM_THEME_ID] as const;

export type PublicThemeId = (typeof PUBLIC_THEME_IDS)[number];
export type ProExclusiveThemeId = (typeof PRO_EXCLUSIVE_THEME_IDS)[number];
export type ThemeId = PublicThemeId | ProExclusiveThemeId;

export interface CustomThemeColors {
    primary: string;
    accent: string;
    highlight: string;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
    primary: '#7c3aed',
    accent: '#a855f7',
    highlight: '#c4b5fd',
};

export const THEME_LABELS: Record<ThemeId, string> = {
    purple: 'Purple',
    emerald: 'Emerald',
    amber: 'Amber',
    rose: 'Rose',
    pro: 'Pro Gold',
    custom: 'Custom',
};

export function isProGoldTheme(theme: string | undefined): boolean {
    return theme === PRO_GOLD_THEME_ID;
}

export function isCustomTheme(theme: string | undefined): boolean {
    return theme === CUSTOM_THEME_ID;
}

export function isProExclusiveTheme(theme: string | undefined): boolean {
    return theme === PRO_GOLD_THEME_ID || theme === CUSTOM_THEME_ID;
}

/** @deprecated use isProGoldTheme */
export function isProTheme(theme: string | undefined): boolean {
    return isProGoldTheme(theme);
}

export function canUseTheme(theme: ThemeId, isPro: boolean): boolean {
    if (isProExclusiveTheme(theme)) return isPro;
    return PUBLIC_THEME_IDS.includes(theme as PublicThemeId);
}

export function normalizeThemeForUser(theme: string | undefined, isPro: boolean): ThemeId {
    if (isPro && theme === PRO_GOLD_THEME_ID) return PRO_GOLD_THEME_ID;
    if (isPro && theme === CUSTOM_THEME_ID) return CUSTOM_THEME_ID;
    if (theme && PUBLIC_THEME_IDS.includes(theme as PublicThemeId)) return theme as PublicThemeId;
    return 'purple';
}

export function resolveCustomThemeColors(
    colors: CustomThemeColors | undefined | null,
): CustomThemeColors {
    if (!colors?.primary || !colors?.accent || !colors?.highlight) {
        return { ...DEFAULT_CUSTOM_THEME };
    }
    return colors;
}

export function applyCustomThemeVars(colors: CustomThemeColors) {
    const c = resolveCustomThemeColors(colors);
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', c.primary);
    root.style.setProperty('--theme-accent', c.accent);
    root.style.setProperty('--theme-highlight', c.highlight);
    root.style.setProperty('--theme-primary-20', hexAlpha(c.primary, 0.22));
    root.style.setProperty('--theme-primary-10', hexAlpha(c.primary, 0.12));
    root.style.setProperty('--theme-shadow', hexAlpha(c.primary, 0.28));
}

export function clearCustomThemeVars() {
    const root = document.documentElement;
    root.style.removeProperty('--theme-primary');
    root.style.removeProperty('--theme-accent');
    root.style.removeProperty('--theme-highlight');
    root.style.removeProperty('--theme-primary-20');
    root.style.removeProperty('--theme-primary-10');
    root.style.removeProperty('--theme-shadow');
}

function hexAlpha(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return `rgba(124, 58, 237, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pro Gold shell or Custom theme active */
export function isProThemeActive(
    engineState: Pick<EngineState, 'theme'>,
    isPro: boolean,
): boolean {
    return isPro && isProExclusiveTheme(engineState?.theme);
}

/** Pro Gold only (gold vignette, hero, avatar ring) */
export function isProGoldThemeActive(
    engineState: Pick<EngineState, 'theme'>,
    isPro: boolean,
): boolean {
    return isPro && isProGoldTheme(engineState?.theme);
}

/** Extra motion on Pro-exclusive themes */
export function isProMotionEnabled(
    engineState: Pick<EngineState, 'theme'> & { proDashboardVisuals?: boolean },
    isPro: boolean,
): boolean {
    if (!isProThemeActive(engineState, isPro)) return false;
    return engineState.proDashboardVisuals === true;
}

export function applyDocumentTheme(
    engineState: Pick<EngineState, 'theme' | 'customTheme'> | null | undefined,
    isPro: boolean,
) {
    const theme = normalizeThemeForUser(engineState?.theme, isPro);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('pro-theme-active', theme === PRO_GOLD_THEME_ID);
    root.classList.toggle('pro-motion', theme === PRO_GOLD_THEME_ID);
    root.classList.toggle('custom-motion', theme === CUSTOM_THEME_ID);
    if (theme === CUSTOM_THEME_ID) {
        applyCustomThemeVars(resolveCustomThemeColors(engineState?.customTheme));
    } else {
        clearCustomThemeVars();
    }
}

export async function setEngineTheme(theme: ThemeId) {
    await new Promise<void>((resolve) =>
        chrome.runtime.sendMessage(
            { type: 'UPDATE_ENGINE_SETTINGS', settings: { theme } },
            () => resolve(),
        ),
    );
}

export async function setCustomThemeColors(colors: CustomThemeColors) {
    await new Promise<void>((resolve) =>
        chrome.runtime.sendMessage(
            {
                type: 'UPDATE_ENGINE_SETTINGS',
                settings: { theme: CUSTOM_THEME_ID, customTheme: colors },
            },
            () => resolve(),
        ),
    );
}

export async function applyProWelcomePack() {
    await new Promise<void>((resolve) =>
        chrome.runtime.sendMessage(
            {
                type: 'UPDATE_ENGINE_SETTINGS',
                settings: { theme: PRO_GOLD_THEME_ID, proDashboardVisuals: false },
            },
            () => resolve(),
        ),
    );
}

export async function revertProThemeIfNeeded() {
    await new Promise<void>((resolve) =>
        chrome.runtime.sendMessage(
            { type: 'UPDATE_ENGINE_SETTINGS', settings: { theme: 'purple' } },
            () => resolve(),
        ),
    );
}

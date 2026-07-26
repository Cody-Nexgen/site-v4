/**
 * Syncable workspace fields that must travel with the user across devices.
 * Secrets (OAuth tokens) stay local to the extension install.
 */
export const SYNCABLE_WORKSPACE_KEYS = [
    'blocklist',
    'allowedSites',
    'regexBlocklist',
    'categoriesActive',
    'schedules',
    'activeDays',
    'activeHours',
    'dailyResetTime',
    'redirectMessage',
    'requireChallenge',
    'trackBackgroundAudio',
    'draggableTimer',
    'pomodoroWidget',
    'focusMode',
    'inAppBlock',
    'emergencyOverrideSettings',
    'weeklyGoalHours',
    'theme',
    'customTheme',
    'todos',
    'dailyFocusTarget',
    'profileName',
    'profileInitial',
    'profileAvatar',
    'pomodoroSettings',
    'habits',
    'scratchpad',
    'dailyPlanner',
    'savedQuotes',
    'dashboardLayout',
    'proDashboardVisuals',
    'notionJournalingEnabled',
] as const;

export type SyncableWorkspaceKey = (typeof SYNCABLE_WORKSPACE_KEYS)[number];

export function pickSyncableWorkspaceState(state: Record<string, unknown>) {
    const payload: Record<string, unknown> = {};
    for (const key of SYNCABLE_WORKSPACE_KEYS) {
        if (state[key] !== undefined) payload[key] = state[key];
    }
    return payload;
}

export const WEB_DASHBOARD_URL = 'https://dashboard.focuznow.com';
export const WEB_APP_FALLBACK_URL = 'https://focuznow.com/app';
export const WEB_CALENDAR_URL = 'https://focuznow.com/calendar';
export const WEB_APP_ORIGIN = 'https://focuznow.com';
export const SETUP_STORAGE_KEY = 'focuznow-setup-v1';
export const SIDEBAR_COLLAPSED_KEY = 'focuznow-sidebar-collapsed-v1';

/** Tabs managed on the web app — extension opens these in a new browser tab. */
export const WEB_MANAGEMENT_TABS = new Set([
    'calendar',
    'lists',
    'habits',
    'friends',
    'challenges',
    'shop',
    'account',
    'settings',
]);

export function webDashboardUrl(path = '/'): string {
    try {
        return new URL(path, WEB_DASHBOARD_URL).href;
    } catch {
        return `${WEB_DASHBOARD_URL}${path.startsWith('/') ? path : `/${path}`}`;
    }
}

export function webAppTabUrl(tab?: string): string {
    const query = tab ? `?tab=${encodeURIComponent(tab)}` : '';
    return `${WEB_DASHBOARD_URL}${query}`;
}

export function openWebDashboard(tab?: string): void {
    chrome.tabs.create({ url: webAppTabUrl(tab) });
}

export function isSetupComplete(): boolean {
    try {
        return window.localStorage.getItem(SETUP_STORAGE_KEY) === 'done';
    } catch {
        return false;
    }
}

export function markSetupComplete(): void {
    try {
        window.localStorage.setItem(SETUP_STORAGE_KEY, 'done');
    } catch {
        /* ignore */
    }
    void chrome.storage.local.set({ setupCompleted: true });
}

export function readSidebarCollapsed(): boolean {
    try {
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
    try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
        /* ignore */
    }
}

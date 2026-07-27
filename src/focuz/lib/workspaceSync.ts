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
    // Mutation clock — prevents stale cloud pulls from undoing local unblock/block.
    '_localMutationAt',
    // Cloud-managed dashboard data (not live blocking/history stats)
    'focuznow_calendar_events_v1',
    'focuznow_calendar_groups_v1',
    'focuznow_scheduling_links_v2',
    'focuznow_lists_v1',
    'activeChallenges',
    'challengeProgress',
    'completedChallenges',
] as const;

export type SyncableWorkspaceKey = (typeof SYNCABLE_WORKSPACE_KEYS)[number];

export function pickSyncableWorkspaceState(state: Record<string, unknown>) {
    const payload: Record<string, unknown> = {};
    for (const key of SYNCABLE_WORKSPACE_KEYS) {
        if (state[key] !== undefined) payload[key] = state[key];
    }
    return payload;
}

/** Primary web app (management UI). */
export const WEB_DASHBOARD_URL = 'https://focuznow.com/app';
export const WEB_APP_FALLBACK_URL = 'https://focuznow.com/app';
export const WEB_CALENDAR_URL = 'https://focuznow.com/calendar';
export const WEB_APP_ORIGIN = 'https://focuznow.com';
export const SETUP_STORAGE_KEY = 'focuznow-setup-v1';
export const SIDEBAR_COLLAPSED_KEY = 'focuznow-sidebar-collapsed-v1';

/**
 * Tabs that stay in the extension helper (blocking / live session tools).
 * Everything else opens on the web dashboard when running inside Chrome.
 */
export const EXTENSION_HELPER_TABS = new Set([
    'blocklist',
    'sessions',
    'statistics',
]);

/** @deprecated use EXTENSION_HELPER_TABS — kept for OptionsApp imports */
export const WEB_MANAGEMENT_TABS = new Set([
    'overview',
    'calendar',
    'lists',
    'habits',
    'friends',
    'challenges',
    'shop',
    'account',
    'settings',
    'progress',
    'achievements',
    'forest',
    'ai_patterns',
    'patterns',
    'focus_rooms',
    'ai_coach',
    'support',
]);

export function isExtensionHelperTab(tab: string): boolean {
    return EXTENSION_HELPER_TABS.has(tab);
}

export function shouldOpenTabOnWeb(tab: string): boolean {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
            return !isExtensionHelperTab(tab);
        }
    } catch {
        /* web */
    }
    return false;
}

export function webDashboardUrl(path = '/'): string {
    try {
        return new URL(path, WEB_APP_ORIGIN).href;
    } catch {
        return `${WEB_APP_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
    }
}

export function webAppTabUrl(tab?: string): string {
    const query = tab ? `?tab=${encodeURIComponent(tab)}` : '';
    return `${WEB_DASHBOARD_URL}${query}`;
}

export function openWebDashboard(tab?: string): void {
    const url = webAppTabUrl(tab);
    try {
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            chrome.tabs.create({ url });
            return;
        }
    } catch {
        /* fall through */
    }
    window.open(url, '_blank', 'noopener,noreferrer');
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
    try {
        void chrome.storage.local.set({ setupCompleted: true });
    } catch {
        /* ignore */
    }
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

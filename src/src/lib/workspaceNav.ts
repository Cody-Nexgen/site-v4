/** Single source of truth for extension workspace navigation. */

export type NavTab = {
    id: string;
    label: string;
};

export type NavSection = {
    id: string;
    label: string;
    tabs: NavTab[];
};

export const PRIMARY_NAV: NavTab[] = [
    { id: 'overview', label: 'Dashboard' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'ai_coach', label: 'AI Coach' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'blocklist', label: 'Blocklist' },
    { id: 'habits', label: 'Habits' },
    { id: 'statistics', label: 'Stats' },
];

export const COLLAPSIBLE_NAV: NavSection[] = [
    {
        id: 'progress',
        label: 'Progress',
        tabs: [
            { id: 'progress', label: 'Overview' },
            { id: 'challenges', label: 'Challenges' },
            { id: 'forest', label: 'Forest' },
        ],
    },
    {
        id: 'social',
        label: 'Social',
        tabs: [
            { id: 'friends', label: 'Friends' },
            { id: 'focus_rooms', label: 'Focus Rooms' },
        ],
    },
];

export const ACCOUNT_NAV: NavTab[] = [
    { id: 'account', label: 'Account' },
    { id: 'settings', label: 'Preferences' },
    { id: 'support', label: 'Help' },
    { id: 'shop', label: 'Focuz Shop' },
    { id: 'patterns', label: 'Patterns' },
];

export const WORKSPACE_NAV: NavSection[] = [
    {
        id: 'general',
        label: 'General',
        tabs: PRIMARY_NAV,
    },
    {
        id: 'progress',
        label: 'Progress',
        tabs: COLLAPSIBLE_NAV[0].tabs,
    },
    {
        id: 'social',
        label: 'Social',
        tabs: COLLAPSIBLE_NAV[1].tabs,
    },
    {
        id: 'account',
        label: 'Account',
        tabs: ACCOUNT_NAV,
    },
];

/** Legacy tab aliases from URLs / bookmarks */
export const TAB_ALIASES: Record<string, string> = {
    achievements: 'progress',
    tasks: 'calendar',
    gamification: 'progress',
};

export function resolveTabId(tab: string | null | undefined): string {
    if (!tab) return 'overview';
    return TAB_ALIASES[tab] ?? tab;
}

export function tabLabel(tab: string): string {
    const id = resolveTabId(tab);
    for (const section of WORKSPACE_NAV) {
        const found = section.tabs.find((t) => t.id === id);
        if (found) return found.label;
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
}

export function tabSection(tab: string): NavSection {
    const id = resolveTabId(tab);
    for (const section of WORKSPACE_NAV) {
        if (section.tabs.some((t) => t.id === id)) return section;
    }
    return WORKSPACE_NAV[0];
}

export function allNavTabs(): NavTab[] {
    return WORKSPACE_NAV.flatMap((s) => s.tabs);
}

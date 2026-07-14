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

export const WORKSPACE_NAV: NavSection[] = [
    {
        id: 'focus',
        label: 'Focuz',
        tabs: [
            { id: 'overview', label: 'Dashboard' },
            { id: 'calendar', label: 'Calendar' },
            { id: 'sessions', label: 'Sessions' },
            { id: 'blocklist', label: 'Block list' },
            { id: 'habits', label: 'Habits' },
        ],
    },
    {
        id: 'progress',
        label: 'Progress',
        tabs: [
            { id: 'progress', label: 'Progress' },
            { id: 'challenges', label: 'Challenges' },
            { id: 'forest', label: 'Forest' },
            { id: 'shop', label: 'Focuz Shop' },
        ],
    },
    {
        id: 'social',
        label: 'Social',
        tabs: [
            { id: 'friends', label: 'Friends' },
            { id: 'focus_rooms', label: 'Focuz Rooms' },
        ],
    },
    {
        id: 'insights',
        label: 'Insights',
        tabs: [
            { id: 'statistics', label: 'Statistics' },
            { id: 'ai_coach', label: 'AI Coach' },
            { id: 'patterns', label: 'Patterns' },
        ],
    },
    {
        id: 'settings',
        label: 'Settings',
        tabs: [
            { id: 'settings', label: 'Preferences' },
            { id: 'support', label: 'Need Help' },
            { id: 'account', label: 'Account' },
        ],
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

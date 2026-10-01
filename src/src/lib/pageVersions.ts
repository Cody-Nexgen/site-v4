// =========================================================
// pageVersions.ts — per-page "new vs legacy" choice.
//
// Stored in engine state (`pageVersions`), so a choice made on the
// website reaches the extension pages (Blocklist, Stats, the blocked-
// site screen) and syncs across devices with the rest of the
// workspace. A localStorage copy avoids a flash of the wrong version
// before engine state has loaded.
// =========================================================

import { useEffect, useState } from 'react';
import { useAuthStore, type EngineState } from './store';
import { setSidebarStyle, useSidebarStyle } from './sidebar';

export type PageVersion = 'new' | 'legacy';
export type PageVersions = Partial<Record<string, PageVersion>>;

export type VersionedPage = {
    /** Tab id (or 'blocked' / 'sidebar' for non-tab surfaces). */
    id: string;
    label: string;
    /** What the new version changed, shown next to the switch. */
    whatsNew: string;
};

export const VERSIONED_PAGES: VersionedPage[] = [
    { id: 'sidebar', label: 'Sidebar', whatsNew: 'Collapsible rail with sections, search and an account menu.' },
    { id: 'settings', label: 'Settings', whatsNew: 'One page for account and preferences, with search and page versions.' },
    { id: 'calendar', label: 'Calendar', whatsNew: 'Card layout, a steady now-line and a simpler booking-link editor.' },
    { id: 'lists', label: 'Lists', whatsNew: 'Notion-style pages: blocks, slash menu, sub-pages, covers and icons.' },
    { id: 'blocklist', label: 'Blocklist', whatsNew: 'Instant, reliable blocking with site icons and bulk actions.' },
    { id: 'blocked', label: 'Blocked-site screen', whatsNew: 'Calmer screen with the reason a site was blocked.' },
    { id: 'habits', label: 'Habits', whatsNew: 'Streaks, a two-week heat strip, rename and undo.' },
    { id: 'statistics', label: 'Stats', whatsNew: '7/30/90-day ranges, categories and a 13-week calendar.' },
    { id: 'progress', label: 'Achievements', whatsNew: 'Level hero, rank path and progress on every badge.' },
    { id: 'challenges', label: 'Challenges', whatsNew: 'Grouped by today, this week and milestones with progress rings.' },
    { id: 'forest', label: 'Forest', whatsNew: 'Smooth canvas forest with tree details and growth stages.' },
    { id: 'friends', label: 'Friends', whatsNew: 'Live status, sent requests, removing friends and a weekly race.' },
];

const CACHE_KEY = 'focuznow-page-versions';

function readCache(): PageVersions {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}') as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as PageVersions) : {};
    } catch {
        return {};
    }
}

function writeCache(versions: PageVersions) {
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(versions));
    } catch {
        /* storage blocked — engine state still has it */
    }
}

/** Every page's chosen version (missing = new). The sidebar lives in its own setting. */
export function usePageVersions(): PageVersions {
    const fromEngine = useAuthStore((s) => s.engineState.pageVersions);
    const [cached] = useState(readCache);
    const sidebar = useSidebarStyle();
    useEffect(() => {
        if (fromEngine) writeCache(fromEngine);
    }, [fromEngine]);
    return { ...(fromEngine ?? cached), sidebar: sidebar === 'legacy' ? 'legacy' : 'new' };
}

export function usePageVersion(id: string): PageVersion {
    return usePageVersions()[id] === 'legacy' ? 'legacy' : 'new';
}

/** Persist one page's version (optimistic, then confirmed by the engine). */
export async function setPageVersion(id: string, version: PageVersion): Promise<void> {
    if (id === 'sidebar') {
        setSidebarStyle(version === 'legacy' ? 'legacy' : 'modern');
        return;
    }
    const current = useAuthStore.getState().engineState.pageVersions ?? readCache();
    const next: PageVersions = { ...current };
    if (version === 'legacy') next[id] = 'legacy';
    else delete next[id];
    await savePageVersions(next);
}

/** Back to the new version everywhere. */
export async function resetPageVersions(): Promise<void> {
    setSidebarStyle('modern');
    await savePageVersions({});
}

export function legacyCount(versions: PageVersions): number {
    return VERSIONED_PAGES.filter((p) => versions[p.id] === 'legacy').length;
}

async function savePageVersions(next: PageVersions) {
    writeCache(next);
    useAuthStore.setState((s) => ({ engineState: { ...s.engineState, pageVersions: next } as EngineState }));
    await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { pageVersions: next } }, () => resolve());
    });
}

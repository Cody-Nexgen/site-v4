import sidebarRedesignImg from '../assets/whats-new/sidebar-redesign.webp';

/**
 * What's-new feed for the sidebar card (§3.5). Config-driven; newest
 * non-dismissed entry wins. Images are bundled via ES imports so both the
 * extension and website builds emit them; entries without art show no image.
 */

export type WhatsNewEntry = {
    id: string;
    /** 16:9 bundled asset URL. Entries without art omit the image area. */
    image: string;
    title: string;
    short: string;
    long: string;
    cta?: { label: string; tab: string };
};

export const WHATS_NEW: WhatsNewEntry[] = [
    {
        id: 'sidebar-redesign',
        image: sidebarRedesignImg,
        title: 'A calmer sidebar',
        short: 'Flat, denser navigation — drag the edge to resize, or collapse to an icon rail.',
        long: 'The workspace sidebar has been rebuilt: it sits flat against the app background, drag its edge anywhere between 200–320px, pull further to collapse into a 52px icon rail, or hide it entirely and peek from the left edge. Ctrl+\\ toggles the rail.',
        cta: { label: 'Try it', tab: 'overview' },
    },
    {
        id: 'accent-picker',
        image: '/whats-new/accent-picker.webp',
        title: 'Accent colors for everyone',
        short: 'Pick an accent — blue, purple, emerald, amber, rose or a custom hue.',
        long: 'Accent colors are no longer a Pro feature. Open your account menu in the sidebar and choose an accent; it recolors focus rings, active items and primary buttons while surfaces stay neutral.',
        cta: { label: 'Open preferences', tab: 'settings' },
    },
];

export const WHATS_NEW_DISMISSED_KEY = 'focuznow-whats-new-dismissed';

export async function readDismissed(): Promise<string[]> {
    try {
        const res = await chrome.storage.local.get([WHATS_NEW_DISMISSED_KEY]);
        const list = res[WHATS_NEW_DISMISSED_KEY];
        return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export async function dismissWhatsNew(id: string): Promise<void> {
    try {
        const prev = await readDismissed();
        const next = [...new Set([...prev, id])].slice(-50);
        await chrome.storage.local.set({ [WHATS_NEW_DISMISSED_KEY]: next });
    } catch {
        /* ignore */
    }
}

export function newestVisible(dismissed: string[]): WhatsNewEntry | null {
    return WHATS_NEW.find((e) => !dismissed.includes(e.id)) ?? null;
}

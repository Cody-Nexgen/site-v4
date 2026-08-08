import { invokeAuthedFunction } from './supabaseFunctions';
import { supabase } from './supabase';

export type LinkPreview = {
    url: string;
    title: string;
    description: string | null;
    siteName: string;
    image: string | null;
    favicon: string | null;
};

type LinkPreviewResponse = {
    url?: string;
    title?: string;
    description?: string | null;
    siteName?: string;
    image?: string | null;
    favicon?: string | null;
    error?: string;
};

function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Basic offline fallback — a favicon + hostname preview when the edge function is unavailable. */
function fallbackPreview(raw: string): LinkPreview {
    const url = normalizeUrl(raw);
    let hostname = raw;
    try {
        hostname = new URL(url).hostname.replace(/^www\./, '');
    } catch {
        /* keep raw input as a best-effort label */
    }
    return {
        url,
        title: hostname || raw,
        description: null,
        siteName: hostname || raw,
        image: null,
        favicon: hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128` : null,
    };
}

/** Fetches Open Graph metadata for a link via the `link-preview` edge function, with a graceful fallback. */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
    const fallback = fallbackPreview(rawUrl);
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return fallback;

        const { data, error } = await invokeAuthedFunction<LinkPreviewResponse>('link-preview', token, {
            url: fallback.url,
        });
        if (error || !data || data.error) return fallback;

        return {
            url: typeof data.url === 'string' && data.url ? data.url : fallback.url,
            title: typeof data.title === 'string' && data.title.trim() ? data.title : fallback.title,
            description: typeof data.description === 'string' ? data.description : null,
            siteName: typeof data.siteName === 'string' && data.siteName.trim() ? data.siteName : fallback.siteName,
            image: typeof data.image === 'string' ? data.image : null,
            favicon: typeof data.favicon === 'string' && data.favicon ? data.favicon : fallback.favicon,
        };
    } catch {
        return fallback;
    }
}

export function isLikelyUrl(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) return false;
    return /^(https?:\/\/)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(\/\S*)?$/i.test(trimmed);
}

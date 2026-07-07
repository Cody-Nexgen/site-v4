/** Single source for Supabase URL + anon key (build-time env or chrome.storage.local override). */
export const SUPABASE_STORAGE_KEY = 'focuznow_supabase_config';

export type SupabaseConfig = {
    url: string;
    anonKey: string;
    isConfigured: boolean;
};

const PLACEHOLDER_URL_FRAGMENTS = ['your-project', 'your-supabase', 'placeholder'];
const PLACEHOLDER_KEY_FRAGMENTS = ['your-anon', 'placeholder'];

function isPlaceholderUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return !url || PLACEHOLDER_URL_FRAGMENTS.some((f) => lower.includes(f));
}

function isPlaceholderKey(key: string): boolean {
    const lower = key.toLowerCase();
    return !key || PLACEHOLDER_KEY_FRAGMENTS.some((f) => lower.includes(f));
}

export function resolveSupabaseConfig(
    envUrl?: string,
    envKey?: string,
    stored?: { url?: string; anonKey?: string } | null,
): SupabaseConfig {
    const url = (stored?.url?.trim() || envUrl?.trim() || '').replace(/\/$/, '');
    const anonKey = stored?.anonKey?.trim() || envKey?.trim() || '';
    const isConfigured = !isPlaceholderUrl(url) && !isPlaceholderKey(anonKey);
    return { url: isConfigured ? url : '', anonKey: isConfigured ? anonKey : '', isConfigured };
}

export async function loadSupabaseConfig(): Promise<SupabaseConfig> {
    const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(SUPABASE_STORAGE_KEY);
        const cfg = stored[SUPABASE_STORAGE_KEY] as { url?: string; anonKey?: string } | undefined;
        return resolveSupabaseConfig(envUrl, envKey, cfg);
    }
    return resolveSupabaseConfig(envUrl, envKey, null);
}

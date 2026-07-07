import { createClient } from '@supabase/supabase-js';
import { loadSupabaseConfig, resolveSupabaseConfig, type SupabaseConfig } from './supabaseConfig';

const chromeStorageAdapter = {
    getItem: (_key: string): Promise<string | null> => {
        return new Promise((resolve) => {
            chrome.storage.local.get('sb-auth-token', (result: { [key: string]: unknown }) => {
                resolve((result['sb-auth-token'] as string) || null);
            });
        });
    },
    setItem: (_key: string, value: string): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ 'sb-auth-token': value }, () => resolve());
        });
    },
    removeItem: (_key: string): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.remove('sb-auth-token', () => resolve());
        });
    },
};

let activeConfig: SupabaseConfig = resolveSupabaseConfig(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    null,
);

function createSupabaseClient(cfg: SupabaseConfig) {
    const url = cfg.isConfigured ? cfg.url : 'https://invalid.supabase.local';
    const key = cfg.isConfigured ? cfg.anonKey : 'not-configured';
    return createClient(url, key, {
        auth: {
            storage: chromeStorageAdapter,
            autoRefreshToken: cfg.isConfigured,
            persistSession: cfg.isConfigured,
            detectSessionInUrl: false,
        },
    });
}

export let supabase = createSupabaseClient(activeConfig);

export function getSupabaseConfig(): SupabaseConfig {
    return activeConfig;
}

export function isSupabaseConfigured(): boolean {
    return activeConfig.isConfigured;
}

/** Call once at startup to apply chrome.storage.local overrides (optional). */
export async function initSupabaseFromStorage(): Promise<SupabaseConfig> {
    const loaded = await loadSupabaseConfig();
    if (
        loaded.isConfigured &&
        (loaded.url !== activeConfig.url || loaded.anonKey !== activeConfig.anonKey)
    ) {
        activeConfig = loaded;
        supabase = createSupabaseClient(activeConfig);
    } else if (!loaded.isConfigured) {
        activeConfig = loaded;
    }
    return activeConfig;
}

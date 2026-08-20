import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadSupabaseConfig, resolveSupabaseConfig, type SupabaseConfig } from './supabaseConfig';

declare global {
    interface Window {
        __FOCUZ_SITE_SUPABASE__?: SupabaseClient;
    }
}

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

function isExtensionRuntime(): boolean {
    try {
        return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
    } catch {
        return false;
    }
}

function createSupabaseClient(cfg: SupabaseConfig) {
    const url = cfg.isConfigured ? cfg.url : 'https://invalid.supabase.local';
    const key = cfg.isConfigured ? cfg.anonKey : 'not-configured';

    // Web host: prefer the site's single client so /app shares the marketing login session.
    if (typeof window !== 'undefined' && window.__FOCUZ_SITE_SUPABASE__) {
        return window.__FOCUZ_SITE_SUPABASE__;
    }

    if (!isExtensionRuntime()) {
        return createClient(url, key, {
            auth: {
                autoRefreshToken: cfg.isConfigured,
                persistSession: cfg.isConfigured,
                detectSessionInUrl: true,
            },
        });
    }

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
    if (typeof window !== 'undefined' && window.__FOCUZ_SITE_SUPABASE__) {
        supabase = window.__FOCUZ_SITE_SUPABASE__;
        const client = window.__FOCUZ_SITE_SUPABASE__;
        const clientUrl = (client as unknown as { supabaseUrl?: string }).supabaseUrl || '';
        const clientKey = (client as unknown as { supabaseKey?: string }).supabaseKey || '';
        if (clientUrl && clientKey && !activeConfig.isConfigured) {
            activeConfig = resolveSupabaseConfig(clientUrl, clientKey, null);
        }
        return activeConfig;
    }

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

/** Bind the website Supabase client before OptionsApp modules initialize. */
export function bindSiteSupabaseClient(
    client: SupabaseClient,
    cfg?: { url?: string; anonKey?: string },
) {
    if (typeof window !== 'undefined') {
        window.__FOCUZ_SITE_SUPABASE__ = client;
    }
    supabase = client;

    // Website Vite often lacks VITE_SUPABASE_* on the extension tree — take URL/key from the host.
    const clientUrl =
        cfg?.url ||
        (client as unknown as { supabaseUrl?: string }).supabaseUrl ||
        '';
    const clientKey =
        cfg?.anonKey ||
        (client as unknown as { supabaseKey?: string }).supabaseKey ||
        '';
    if (clientUrl && clientKey) {
        activeConfig = resolveSupabaseConfig(clientUrl, clientKey, null);
    }
}

/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseConfig, resolveSupabaseConfig, type SupabaseConfig } from './supabaseConfig';

const DEFAULT_URL = 'https://zbgbszatstigtbfvdfpb.supabase.co';
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6Ymdic3phdHN0aWd0YmZ2ZGZwYiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY0MjY2OTQwLCJleHAiOjIwNzk4NDI5NDB9.6Uomu8F8qWp9bTCIwkj4yc48wZDMBT1U8efp9_M2vGw';

function env(key: string): string | undefined {
  try {
    return (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key];
  } catch {
    return undefined;
  }
}

let activeConfig: SupabaseConfig = resolveSupabaseConfig(
  env('VITE_SUPABASE_URL') || DEFAULT_URL,
  env('VITE_SUPABASE_ANON_KEY') || DEFAULT_ANON,
  null,
);

function createSupabaseClient(cfg: SupabaseConfig) {
  const url = cfg.isConfigured ? cfg.url : DEFAULT_URL;
  const key = cfg.isConfigured ? cfg.anonKey : DEFAULT_ANON;
  // Default localStorage — shares session with site-v4 marketing auth client.
  return createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

export let supabase = createSupabaseClient(activeConfig);

export function getSupabaseConfig(): SupabaseConfig {
  return activeConfig;
}

export function isSupabaseConfigured(): boolean {
  return true;
}

export async function initSupabaseFromStorage(): Promise<SupabaseConfig> {
  try {
    const loaded = await loadSupabaseConfig();
    if (
      loaded.isConfigured &&
      (loaded.url !== activeConfig.url || loaded.anonKey !== activeConfig.anonKey)
    ) {
      activeConfig = loaded;
      supabase = createSupabaseClient(activeConfig);
    }
  } catch {
    /* keep defaults */
  }
  return activeConfig;
}

export async function ensureSupabaseReady() {
  return initSupabaseFromStorage();
}

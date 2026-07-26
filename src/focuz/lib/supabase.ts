/// <reference types="vite/client" />
/**
 * Re-use the site's single Supabase client so we don't create a second
 * GoTrueClient under the same storage key (which breaks auth / blank screens).
 */
export { supabase, supabaseUrl as _supabaseUrl, supabaseAnonKey as _supabaseAnonKey } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  isConfigured: boolean;
};

export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: 'https://zbgbszatstigtbfvdfpb.supabase.co',
    anonKey: '',
    isConfigured: true,
  };
}

export function isSupabaseConfigured(): boolean {
  return true;
}

export async function initSupabaseFromStorage(): Promise<SupabaseConfig> {
  return getSupabaseConfig();
}

export async function ensureSupabaseReady() {
  return initSupabaseFromStorage();
}

// Keep a named binding for any code that expects a mutable export.
void supabase;

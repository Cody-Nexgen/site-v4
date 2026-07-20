import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://zbgbszatstigtbfvdfpb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZ2JzemF0c3RpZ3RiZnZkZnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjY5NDAsImV4cCI6MjA3OTg0Mjk0MH0.6Uomu8F8qWp9bTCIwkj4yc48wZDMBT1U8efp9_M2vGw';

// The anonymous key is public browser configuration protected by Supabase RLS.
// Vercel environment values can override these production defaults.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;
export const isAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

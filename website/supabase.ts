
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Safely access process.env
const getEnvVar = (key: string, defaultValue: string) => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || defaultValue;
    }
  } catch (e) {
    // Ignore error if process is not defined
  }
  return defaultValue;
};

// IMPORTANT: Replace these with your actual Supabase credentials
const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://zbgbszatstigtbfvdfpb.supabase.co');

// Corrected: The actual key string is now passed as the default value (2nd argument)
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZ2JzemF0c3RpZ3RiZnZkZnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjY5NDAsImV4cCI6MjA3OTg0Mjk0MH0.6Uomu8F8qWp9bTCIwkj4yc48wZDMBT1U8efp9_M2vGw');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

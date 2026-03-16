import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { storage } from '../storage'

/**
 * Custom storage adapter for Supabase to use our universal storage utility.
 * This ensures the session is mirrored to Native Preferences on Android/iOS.
 */
const supabaseStorage = {
  getItem: (key: string) => {
    return storage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    return storage.setItem(key, value);
  },
  removeItem: (key: string) => {
    return storage.removeItem(key);
  }
};

// Helper to validate and get env vars
const getSupabaseEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error('CRITICAL: Supabase environment variables are missing!');
  }
  
  return { url: url || '', anonKey: anonKey || '' };
};

/**
 * Browser-safe client for Next.js components.
 * Configured with persistent storage for Capacitor.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
}

/**
 * Standard client for Node.js scripts / tests.
 * Uses the same storage to maintain consistency in local environments.
 */
export function createServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
}

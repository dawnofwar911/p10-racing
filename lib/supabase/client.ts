import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { storage } from '../storage'

// Custom storage adapter for Supabase to use our universal storage
const supabaseStorage = {
  getItem: (key: string) => {
    // Supabase expect a string or null synchronously for its internal state
    // but can handle async storage if provided. However, our getItem is async.
    // We use a trick: we return the promise, and Supabase handles it if it's an async storage.
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
    console.error('CRITICAL: Supabase environment variables are missing!', {
      url: !!url,
      anonKey: !!anonKey
    });
  }
  
  return { url: url || '', anonKey: anonKey || '' };
};

// Browser-safe client for Next.js components
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey, {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}

// Standard client for Node.js scripts / tests
export function createServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}

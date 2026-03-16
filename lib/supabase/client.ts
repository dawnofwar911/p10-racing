import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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
  return createBrowserClient(url, anonKey);
}

// Standard client for Node.js scripts / tests
export function createServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey);
}

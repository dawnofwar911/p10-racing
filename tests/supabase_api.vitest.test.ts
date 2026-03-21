import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import { createServerClient, createClient } from '@/lib/supabase/client';

// Mock environment variables for Supabase Client initialization
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

describe('Supabase Client & API Integration', () => {
  const supabase = createServerClient();

  it('should initialize browser client with createClient', () => {
    // In JSDOM, window is defined, so this will exercise the browser singleton branch
    const client = createClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    
    // Check singleton behavior
    const secondCall = createClient();
    expect(secondCall).toBe(client);
  });

  it('should fetch predictions and return mock data', async () => {
    // 1. Setup MSW handler for the specific Supabase select call
    server.use(
      http.get('https://mock-project.supabase.co/rest/v1/predictions', () => {
        return HttpResponse.json([
          { id: '1', race_id: '2026_1', p10_driver_id: 'verstappen', dnf_driver_id: 'hamilton' }
        ]);
      })
    );

    // 2. Call the real client
    const { data, error } = await supabase.from('predictions').select('*');

    // 3. Assertions
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].p10_driver_id).toBe('verstappen');
  });

  it('should handle RPC call for joining a league', async () => {
    // 1. Setup MSW handler for RPC join_league_by_code
    server.use(
      http.post('https://mock-project.supabase.co/rest/v1/rpc/join_league_by_code', () => {
        return HttpResponse.json({ id: 'league-123', name: 'Mock League' });
      })
    );

    // 2. Call the RPC
    const { data, error } = await supabase.rpc('join_league_by_code', { code: 'ABC12345' });

    // 3. Assertions
    expect(error).toBeNull();
    expect(data.name).toBe('Mock League');
  });

  it('should handle authentication errors (401)', async () => {
    // 1. Setup MSW handler for 401 Unauthorized
    server.use(
      http.get('https://mock-project.supabase.co/rest/v1/leagues', () => {
        return new HttpResponse(JSON.stringify({ message: 'JWT expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );

    // 2. Call the client
    const { data, error } = await supabase.from('leagues').select('*');

    // 3. Assertions
    expect(data).toBeNull();
    expect(error).toBeDefined();
    expect(error!.message).toBe('JWT expired');
  });
});

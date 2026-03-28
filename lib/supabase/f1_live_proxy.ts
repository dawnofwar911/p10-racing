// Supabase Edge Function: f1-live-proxy
// Fetches live timing data from official F1 static JSON feeds

import { createClient } from 'npm:@supabase/supabase-js@2';

const BASE_URL = 'https://livetiming.formula1.com/static';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Mapping from F1 Acronyms to internal Driver IDs
const ACRONYM_TO_ID: { [key: string]: string } = {
  'VER': 'max_verstappen', 'HAD': 'hadjar',
  'HAM': 'hamilton', 'LEC': 'leclerc',
  'NOR': 'norris', 'PIA': 'piastri',
  'RUS': 'russell', 'ANT': 'antonelli',
  'ALO': 'alonso', 'STR': 'stroll',
  'GAS': 'gasly', 'COL': 'colapinto',
  'ALB': 'albon', 'SAI': 'sainz',
  'LAW': 'lawson', 'LIN': 'arvid_lindblad',
  'HUL': 'hulkenberg', 'BOR': 'bortoleto',
  'OCO': 'ocon', 'BEA': 'bearman',
  'PER': 'perez', 'BOT': 'bottas'
};

interface F1Index {
  Seasons?: { Year: number }[];
  Meetings?: { Path: string }[];
  Sessions?: { Path: string, Name: string }[];
}

interface TimingData {
  Lines: {
    [driverNumber: string]: {
      Position: string;
      GapToLeader: string;
      IntervalToNext: string;
      Stopped: boolean;
      InPit: boolean;
      Retired: boolean;
    }
  };
}

interface SessionInfo {
  Meeting: { Name: string };
  Session: { Name: string };
  Type: string;
  Status: string;
}

Deno.serve(async (req) => {
  // 1. CORS Headers - Securely derived from environment
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL'), 
    'http://localhost:3000',
    'http://localhost:3001',
    'capacitor://localhost',
    'http://localhost'
  ].filter(Boolean);

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Security: Verify Secret
  const authHeader = req.headers.get('Authorization');
  const customCronHeader = req.headers.get('X-Cron-Secret');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  
  if (CRON_SECRET) {
    const expectedBearer = `Bearer ${CRON_SECRET}`;
    if (authHeader !== expectedBearer && authHeader !== CRON_SECRET && customCronHeader !== CRON_SECRET) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
  }

  try {
    // 2. Validate Environment
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Server configuration error: Missing Supabase credentials');
    }

    const url = new URL(req.url);
    const forceSeason = url.searchParams.get('season');
    const forceMeeting = url.searchParams.get('meeting');
    const forceSession = url.searchParams.get('session');

    // 3. Check Cache (Viral-Proofing with Stale-While-Revalidate)
    const cacheKey = `f1_live_${forceSeason || 'latest'}_${forceMeeting || 'latest'}_${forceSession || 'latest'}`;
    const CACHE_FRESH_MS = 30 * 1000;
    const CACHE_STALE_MS = 60 * 1000; // Allow stale data for 60s while background refreshing

    const { data: cached } = await supabase
      .from('kv_cache')
      .select('value, updated_at')
      .eq('key', cacheKey)
      .maybeSingle();

    if (cached) {
      const updatedAt = new Date(cached.updated_at).getTime();
      const now = new Date().getTime();
      const age = now - updatedAt;

      if (age < CACHE_FRESH_MS) {
        // Cache is fresh - Return HIT
        return new Response(JSON.stringify(cached.value), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'Cache-Control': 'public, max-age=30'
          },
        });
      } else if (age < CACHE_STALE_MS) {
        // Cache is stale but acceptable - Return STALE and trigger background refresh
        // We don't await this, it runs in the background
        edgeRefresh(cacheKey, { forceSeason, forceMeeting, forceSession }).catch(console.error);

        return new Response(JSON.stringify(cached.value), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Cache': 'STALE',
            'Cache-Control': 'public, max-age=5' // Tell client to check back very soon
          },
        });
      }
    }

    // 4. MISS or expired stale - Perform full fetch
    const simplified = await fetchAndProcess(forceSeason, forceMeeting, forceSession);

    // 5. Update Cache (Background)
    supabase.from('kv_cache').upsert({
      key: cacheKey,
      value: simplified,
      updated_at: new Date().toISOString()
    }).catch(err => console.error('Cache Update Error:', err));

    return new Response(JSON.stringify(simplified), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=30'
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper to handle background refreshes to avoid blocking the user
async function edgeRefresh(cacheKey: string, params: { forceSeason: string | null, forceMeeting: string | null, forceSession: string | null }) {
  try {
    const simplified = await fetchAndProcess(params.forceSeason, params.forceMeeting, params.forceSession);
    await supabase.from('kv_cache').upsert({
      key: cacheKey,
      value: simplified,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Background Refresh Failed:', e);
  }
}

async function fetchAndProcess(forceSeason: string | null, forceMeeting: string | null, forceSession: string | null) {
    let season = forceSeason;
    let meeting = forceMeeting;
    let session = forceSession;

    // Discover Path if not forced
    if (!season) {
      const resp = await fetch(`${BASE_URL}/Index.json`);
      if (!resp.ok) throw new Error('Failed to fetch Seasons index');
      const data: F1Index = await resp.json();
      season = data.Seasons?.[data.Seasons.length - 1]?.Year.toString() || new Date().getFullYear().toString();
    }

    if (!meeting) {
      const resp = await fetch(`${BASE_URL}/${season}/Index.json`);
      if (!resp.ok) throw new Error('Failed to fetch Meetings index');
      const data: F1Index = await resp.json();
      meeting = data.Meetings?.[data.Meetings.length - 1]?.Path || '';
    }

    if (!session) {
      const resp = await fetch(`${BASE_URL}/${season}/${meeting}Index.json`);
      if (!resp.ok) throw new Error('Failed to fetch Sessions index');
      const data: F1Index = await resp.json();
      const raceSession = data.Sessions?.find(s => s.Name.toLowerCase() === 'race');
      session = raceSession?.Path || data.Sessions?.[data.Sessions.length - 1]?.Path || '';
    }

    const sessionPath = `${BASE_URL}/${season}/${meeting}${session}`;

    // Fetch Timing, Session Info, and Driver List in parallel
    const [timingResp, sessionResp, driverListResp] = await Promise.all([
      fetch(`${sessionPath}TimingData.json`),
      fetch(`${sessionPath}SessionInfo.json`),
      fetch(`${sessionPath}DriverList.json`)
    ]);

    if (!timingResp.ok) throw new Error(`Failed to fetch timing data: ${timingResp.status}`);
    if (!sessionResp.ok) throw new Error(`Failed to fetch session info: ${sessionResp.status}`);
    if (!driverListResp.ok) throw new Error(`Failed to fetch driver list: ${driverListResp.status}`);

    const [timingData, sessionInfo, driverListData] = await Promise.all([
      timingResp.json() as Promise<TimingData>,
      sessionResp.json() as Promise<SessionInfo>,
      driverListResp.json()
    ]);

    // Map and Simplify Results
    const results = Object.entries(timingData.Lines).map(([number, data]) => {
      const driver = driverListData[number];
      const acronym = driver?.Tla || '';
      return {
        driverId: ACRONYM_TO_ID[acronym] || acronym.toLowerCase(),
        acronym,
        position: parseInt(data.Position) || 0,
        gap: data.GapToLeader || '',
        interval: data.IntervalToNext || '',
        isRetired: data.Retired || data.Stopped || false,
        inPit: data.InPit || false,
        number
      };
    }).sort((a, b) => (a.position || 99) - (b.position || 99));

    return {
      status: sessionInfo.Status,
      meeting: sessionInfo.Meeting.Name,
      session: sessionInfo.Session.Name,
      results: results,
      lastUpdated: new Date().toISOString()
    };
}

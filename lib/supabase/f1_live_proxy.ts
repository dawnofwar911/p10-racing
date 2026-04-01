// Supabase Edge Function: f1-live-proxy
// Cache-First version: Prioritizes SignalR relay data from DB
// Fetches live timing data from official F1 static JSON feeds

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'npm:@supabase/supabase-js@2';

const BASE_URL = 'https://livetiming.formula1.com/static';
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Fallback Mapping from F1 Acronyms to internal Driver IDs
// Fallback Mapping from F1 Acronyms to internal Driver IDs
const ACRONYM_TO_ID: { [key: string]: string } = {
  'NOR': 'norris', 'VER': 'max_verstappen',
  'BOR': 'bortoleto', 'HAD': 'hadjar',
  'GAS': 'gasly', 'PER': 'perez',
  'ANT': 'antonelli', 'ALO': 'alonso',
  'LEC': 'leclerc', 'STR': 'stroll',
  'ALB': 'albon', 'HUL': 'hulkenberg',
  'LAW': 'lawson', 'OCO': 'ocon',
  'LIN': 'arvid_lindblad', 'COL': 'colapinto',
  'HAM': 'hamilton', 'SAI': 'sainz',
  'RUS': 'russell', 'BOT': 'bottas',
  'PIA': 'piastri', 'BEA': 'bearman'
};

async function fetchOfficialDrivers(
  season: string, 
  numberMap: Record<string, string>, 
  acronymMap: Record<string, string>
) {
  try {
    const resp = await fetch(`${JOLPICA_BASE}/${season}/drivers.json`);
    if (!resp.ok) return;
    const data = await resp.json();
    const drivers = data.MRData.DriverTable.Drivers;

    drivers.forEach((d: { permanentNumber?: string; code?: string; driverId: string }) => {
      if (d.permanentNumber) {
        numberMap[d.permanentNumber] = d.driverId;
      }
      if (d.code) {
        acronymMap[d.code] = d.driverId;
      }
    });
  } catch (e) {
    console.warn("Failed to fetch official drivers", e);
  }
}

interface F1Session {
  Key: number; Type: string; Name: string; StartDate: string; EndDate: string; Path?: string;
}
interface F1Meeting {
  Key: number; Name: string; Sessions: F1Session[];
}
interface F1Index {
  Meetings?: F1Meeting[];
}
interface TimingData {
  Lines: { [driverNumber: string]: { Position: string; GapToLeader: string; IntervalToNext: string; Stopped: boolean; InPit: boolean; Retired: boolean; Status: string; NumberOfLaps: string; } };
}
interface SessionInfo {
  Meeting: { Name: string }; Session: { Name: string }; Type: string; Status: string;
}

/**
 * Shared utility to determine if a status string indicates a true DNF.
 */
function isTrueDnf(status: string, laps: string | number = "1"): boolean {
  const s = String(status || '').toLowerCase();
  const isFinished = s === "finished" || s.includes("lap");
  const isDns = s.includes("not start") || s === "dns" || s.includes("qualify") || s.includes("withdrawn");
  const lapCount = typeof laps === 'string' ? parseInt(laps) : laps;
  const hasLaps = lapCount > 0;
  
  return !isFinished && !isDns && hasLaps;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
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
    // 3. CHECK CACHE FIRST (Prioritize SignalR Relay)
    const cacheKey = `f1_live_timing_latest`;
    const { data: cached } = await supabase
      .from('kv_cache')
      .select('value, updated_at')
      .eq('key', cacheKey)
      .maybeSingle();

    if (cached) {
      const updatedAt = new Date(cached.updated_at).getTime();
      const now = new Date().getTime();
      // Trust the SignalR relay cache for up to 10 minutes (Viral-Proofing Shield)
      if (now - updatedAt < 600000) {
        return new Response(JSON.stringify(cached.value), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT-RELAY' },
        });
      }
    }

    // 4. FALLBACK TO STATIC FILES (Only if relay is down)
    const url = new URL(req.url);
    const forceSeason = url.searchParams.get('season');
    const forceSession = url.searchParams.get('session');
    const season = forceSeason || new Date().getFullYear().toString();
    
    let sessionPath = '';
    const resp = await fetchWithTimeout(`${BASE_URL}/${season}/Index.json`);
    if (!resp.ok) throw new Error(`Failed to fetch index: ${resp.status}`);
    const data: F1Index = await resp.json();

    const sortedMeetings = data.Meetings?.sort((a, b) => {
      const aStart = new Date(a.Sessions?.[0]?.StartDate || 0).getTime();
      const bStart = new Date(b.Sessions?.[0]?.StartDate || 0).getTime();
      return bStart - aStart;
    });

    const currentMeeting = sortedMeetings?.find(m => {
      return m.Sessions?.some((s: F1Session) => {
        const start = new Date(s.StartDate).getTime();
        const diffDays = Math.abs(new Date().getTime() - start) / (1000 * 60 * 60 * 24);
        return diffDays < 4;
      });
    }) || sortedMeetings?.[0];

    if (!currentMeeting) throw new Error("No meeting found");

    const sessions = currentMeeting.Sessions || [];
    const raceSession = sessions.find((s: F1Session) => s.Type === 'Race' || s.Name === 'Race');
    const targetSession = forceSession ? sessions.find((s: F1Session) => s.Name === forceSession) : (raceSession || sessions[sessions.length - 1]);

    if (!targetSession) throw new Error("Target session not found");

    if (targetSession.Path) {
      sessionPath = targetSession.Path;
    } else {
      const sessionWithPadding = sessions.find((s: F1Session) => s.Path);
      if (sessionWithPadding && sessionWithPadding.Path) {
        const parts = sessionWithPadding.Path.split('/');
        const meetingRoot = parts.slice(0, 2).join('/');
        const sessionDate = targetSession.StartDate.split('T')[0];
        sessionPath = `${meetingRoot}/${sessionDate}_${targetSession.Name.replace(/ /g, '_')}/`;
      }
    }

    if (!sessionPath) throw new Error("Could not discover session path");

    const fullPath = `${BASE_URL}/${sessionPath}`;
    
    // 5. Build per-request dynamic mapping to ensure concurrency safety
    const dynamicNumberToId: Record<string, string> = {};
    const dynamicAcronymToId: Record<string, string> = {};

    // Fetch dynamic drivers concurrently with static timing data
    const [timingResp, sessionResp, driverListResp] = await Promise.all([
      fetchWithTimeout(`${fullPath}TimingData.json`),
      fetchWithTimeout(`${fullPath}SessionInfo.json`),
      fetchWithTimeout(`${fullPath}DriverList.json`),
      fetchOfficialDrivers(season, dynamicNumberToId, dynamicAcronymToId)
    ]);

    if (timingResp.status === 403 || timingResp.status === 404) {
      return new Response(JSON.stringify({ error: "Waiting for track data..." }), {
        status: timingResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!timingResp.ok) throw new Error(`Timing fetch failed: ${timingResp.status}`);
    
    const [timingData, sessionInfo, driverListData] = await Promise.all([
      timingResp.json() as Promise<TimingData>,
      sessionResp.json() as Promise<SessionInfo>,
      driverListResp.json()
    ]);

    const results = Object.entries(timingData.Lines).map(([number, data]) => {
      const driver = driverListData[number];
      const acronym = driver?.Tla || '';
      
      // PRIORITY: 1. Dynamic Number Map, 2. Dynamic Acronym Map, 3. Static Fallback, 4. Lowercase Acronym or Unknown
      const driverId = dynamicNumberToId[number] || 
                       (acronym ? dynamicAcronymToId[acronym] : null) || 
                       ACRONYM_TO_ID[acronym] || 
                       (acronym ? acronym.toLowerCase() : `unknown_${number}`);

      return {
        driverId,
        acronym,
        position: parseInt(data.Position) || 0,
        gap: data.GapToLeader || '',
        interval: data.IntervalToNext || '',
        isRetired: isTrueDnf(data.Status || '', data.NumberOfLaps || '1') || data.Retired || data.Stopped || false,
        inPit: data.InPit || false,
        number
      };
    }).sort((a, b) => (a.position || 99) - (b.position || 99));

    const simplified = {
      status: sessionInfo.Status, meeting: sessionInfo.Meeting?.Name || 'Unknown', session: sessionInfo.Session?.Name || 'Unknown',
      results: results, lastUpdated: new Date().toISOString()
    };

    return new Response(JSON.stringify(simplified), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS-STATIC' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

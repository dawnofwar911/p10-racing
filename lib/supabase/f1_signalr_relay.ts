// Supabase Edge Function: f1-signalr-relay
// Connects to F1 SignalR real-time stream and caches data to DB

import { createClient } from 'npm:@supabase/supabase-js@2';
import pako from 'npm:pako';

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

const SIGNALR_BASE = 'https://livetiming.formula1.com/signalr';
const STATIC_BASE = 'https://livetiming.formula1.com/static';
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const HUB_NAME = 'Streaming';

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
  Lines: { [driverNumber: string]: { Position?: string; GapToLeader?: string; IntervalToNext?: string; Stopped?: boolean; InPit?: boolean; Retired?: boolean; Status?: string; NumberOfLaps?: string; [key: string]: unknown; } };
}
interface SessionInfo {
  Meeting: { Name: string; [key: string]: unknown; }; Session: { Name: string; [key: string]: unknown; }; Type: string; Status: string; ArchiveStatus?: { Status: string; [key: string]: unknown; }; [key: string]: unknown;
}
interface TyreData {
  Lines: { [driverNumber: string]: { Compound?: string; New?: string | boolean; TyresNotChangedLaps?: number; [key: string]: unknown; } };
}
interface TrackStatus {
  Status: string; Message: string;
}

interface SignalRMessage {
  R?: {
    TimingData?: TimingData;
    Lines?: Record<string, unknown>;
    SessionInfo?: SessionInfo;
    TyreData?: TyreData;
    TrackStatus?: TrackStatus;
  };
  M?: Array<{
    M: string;
    A: unknown[];
  }>;
}

interface RelayState {
  currentTiming: TimingData;
  currentTyres: TyreData;
  trackStatus: TrackStatus;
  driverList: Record<string, { Tla: string; [key: string]: unknown }>;
  sessionInfo: SessionInfo;
  dynamicNumberToId: Record<string, string>;
  dynamicAcronymToId: Record<string, string>;
}

/**
 * Shared utility to determine if a status string or telemetry state indicates 
 * a true DNF (Retired during race). Excludes DNS (Did not start) and 
 * other non-participation statuses.
 */
function isTrueDnf(status: string, laps: string | number = "1"): boolean {
  const s = String(status || '').toLowerCase();
  const isFinished = s === "finished" || s.includes("lap");
  const isDns = s.includes("not start") || s === "dns" || s.includes("qualify") || s.includes("withdrawn");
  const lapCount = typeof laps === 'string' ? parseInt(laps) : laps;
  const hasLaps = lapCount > 0;
  
  return !isFinished && !isDns && hasLaps;
}

// Robust 2026 Mapping (Number -> ID)
const NUMBER_TO_ID: { [key: string]: string } = {
  '1': 'norris', '3': 'max_verstappen', '5': 'bortoleto', '6': 'hadjar',
  '10': 'gasly', '11': 'perez', '12': 'antonelli', '14': 'alonso',
  '16': 'leclerc', '18': 'stroll', '23': 'albon', '27': 'hulkenberg',
  '30': 'lawson', '31': 'ocon', '41': 'arvid_lindblad', '43': 'colapinto',
  '44': 'hamilton', '55': 'sainz', '63': 'russell', '77': 'bottas',
  '81': 'piastri', '87': 'bearman'
};

// Acronym mapping for display
const ACRONYM_TO_ID: { [key: string]: string } = {
  'NOR': 'norris', 'VER': 'max_verstappen', 'BOR': 'bortoleto', 'HAD': 'hadjar',
  'GAS': 'gasly', 'PER': 'perez', 'ANT': 'antonelli', 'ALO': 'alonso',
  'LEC': 'leclerc', 'STR': 'stroll', 'ALB': 'albon', 'HUL': 'hulkenberg',
  'LAW': 'lawson', 'OCO': 'ocon', 'LIN': 'arvid_lindblad', 'COL': 'colapinto',
  'HAM': 'hamilton', 'SAI': 'sainz', 'RUS': 'russell', 'BOT': 'bottas',
  'PIA': 'piastri', 'BEA': 'bearman'
};

// Warm-start cache for dynamic mappings (Season -> Mapping)
const GLOBAL_DRIVER_CACHE: Record<string, { 
  numberMap: Record<string, string>; 
  acronymMap: Record<string, string>;
  expires: number;
}> = {};

/**
 * PHASE 0: DYNAMIC METADATA
 * Fetches the official driver list from Jolpica to build mappings automatically.
 */
async function fetchOfficialDrivers(
  season: string,
  numberMap: Record<string, string>,
  acronymMap: Record<string, string>
) {
  // Check warm-start cache first (1 hour expiry)
  const cached = GLOBAL_DRIVER_CACHE[season];
  if (cached && cached.expires > Date.now()) {
    Object.assign(numberMap, cached.numberMap);
    Object.assign(acronymMap, cached.acronymMap);
    return;
  }

  try {
    const resp = await fetchWithTimeout(`${JOLPICA_BASE}/${season}/drivers.json`);
    if (!resp.ok) return;
    const data = await resp.json();
    const drivers = data.MRData.DriverTable.Drivers;

    const newNumberMap: Record<string, string> = {};
    const newAcronymMap: Record<string, string> = {};

    drivers.forEach((d: { permanentNumber?: string; code?: string; driverId: string }) => {
      if (d.permanentNumber) {
        newNumberMap[d.permanentNumber] = d.driverId;
      }
      if (d.code) {
        newAcronymMap[d.code] = d.driverId;
      }
    });

    // Update local maps for current request
    Object.assign(numberMap, newNumberMap);
    Object.assign(acronymMap, newAcronymMap);

    // Update global cache for warm starts
    GLOBAL_DRIVER_CACHE[season] = {
      numberMap: newNumberMap,
      acronymMap: newAcronymMap,
      expires: Date.now() + 3600000 // 1 hour
    };
    console.log(`Loaded ${drivers.length} drivers from Jolpica.`);
  } catch (e) {
    console.warn("Failed to fetch official drivers", e);
  }
}

/**
 * PATH DISCOVERY
 */
async function discoverPathAndFetchInitial(season: string, state: RelayState) {
  const resp = await fetchWithTimeout(`${STATIC_BASE}/${season}/Index.json`);
  if (!resp.ok) return;
  const data: F1Index = await resp.json();
  
  if (!data.Meetings) return;
  
  const now = new Date();
  const sortedMeetings = data.Meetings.sort((a: F1Meeting, b: F1Meeting) => {
    const aStart = new Date(a.Sessions?.[0]?.StartDate || 0);
    const bStart = new Date(b.Sessions?.[0]?.StartDate || 0);
    return bStart.getTime() - aStart.getTime();
  });

  const currentMeeting = sortedMeetings.find((m: F1Meeting) => {
    return m.Sessions?.some((s: F1Session) => {
      const start = new Date(s.StartDate);
      const diffDays = Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays < 4;
    });
  }) || sortedMeetings[0];

  const sessions = currentMeeting.Sessions || [];
  const targetSession = sessions.find((s: F1Session) => s.Type === 'Race' || s.Name === 'Race') || sessions[sessions.length - 1];

  let sessionPath = targetSession.Path;
  if (!sessionPath) {
    const sessionWithPadding = sessions.find((s: F1Session) => s.Path);
    if (sessionWithPadding) {
      const parts = sessionWithPadding.Path.split('/');
      const meetingRoot = parts.slice(0, 2).join('/');
      const sessionDate = targetSession.StartDate.split('T')[0];
      sessionPath = `${meetingRoot}/${sessionDate}_${targetSession.Name.replace(/ /g, '_')}/`;
    }
  }

  if (sessionPath) {
    const fullPath = `${STATIC_BASE}/${sessionPath}`;
    try {
      console.log(`Attempting to fetch initial metadata from: ${fullPath}`);
      const [dlResp, siResp] = await Promise.all([
        fetchWithTimeout(`${fullPath}DriverList.json`),
        fetchWithTimeout(`${fullPath}SessionInfo.json`)
      ]);
      if (dlResp.ok) {
        state.driverList = await dlResp.json();
        console.log(`DriverList loaded: ${Object.keys(state.driverList).length} drivers.`);
      }
      if (siResp.ok) state.sessionInfo = await siResp.json();
    } catch (e) {
      console.warn("Failed to fetch initial data", e);
    }
  }
}

/**
 * SIGNALR HUB
 */
async function negotiate() {
  const negotiateUrl = `${SIGNALR_BASE}/negotiate?connectionData=${encodeURIComponent(JSON.stringify([{ name: HUB_NAME }]))}&clientProtocol=1.5`;
  const resp = await fetchWithTimeout(negotiateUrl, {
    method: 'GET',
    headers: { 'User-Agent': 'BestRacingApp/1.0', 'Accept': 'application/json' }
  });
  if (!resp.ok) throw new Error(`SignalR Negotiation Failed: ${resp.status}`);
  const data = await resp.json();
  return { token: data.ConnectionToken };
}

function decodeAndDecompress(base64Data: string) {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decompressed = pako.inflateRaw(bytes, { to: 'string' });
    return JSON.parse(decompressed);
  } catch {
    return null;
  }
}

function robustMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  if (!source) return target;
  Object.keys(source).forEach(key => {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
      robustMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      target[key] = source[key];
    }
  });
  return target;
}

function handleMessage(msg: SignalRMessage, state: RelayState) {
  if (Object.keys(msg).length === 0) return;

  if (msg.R) {
    const timingData = msg.R.TimingData || (msg.R.Lines ? msg.R as unknown as TimingData : null);
    const infoData = msg.R.SessionInfo;
    const tyreData = msg.R.TyreData;
    const tsData = msg.R.TrackStatus;

    if (timingData) robustMerge(state.currentTiming as unknown as Record<string, unknown>, timingData as unknown as Record<string, unknown>);
    if (infoData) robustMerge(state.sessionInfo as unknown as Record<string, unknown>, infoData as unknown as Record<string, unknown>);
    if (tyreData) robustMerge(state.currentTyres as unknown as Record<string, unknown>, tyreData as unknown as Record<string, unknown>);
    if (tsData) robustMerge(state.trackStatus as unknown as Record<string, unknown>, tsData as unknown as Record<string, unknown>);
  }
  
  if (msg.M && Array.isArray(msg.M)) {
    for (const m of msg.M) {
      if (m.M === 'feed' || m.M === 'Receive') {
        let feedName = m.A[0] as string;
        const rawData = m.A[1] as string;
        if (!rawData) continue;

        const isCompressed = typeof feedName === 'string' && feedName.endsWith('.z');
        if (isCompressed) feedName = feedName.slice(0, -2);

        const decoded = isCompressed ? decodeAndDecompress(rawData) : rawData;
        if (!decoded) continue;

        if (feedName === 'TimingData') {
          robustMerge(state.currentTiming as unknown as Record<string, unknown>, decoded as unknown as Record<string, unknown>);
        } else if (feedName === 'SessionInfo') {
          robustMerge(state.sessionInfo as unknown as Record<string, unknown>, decoded as unknown as Record<string, unknown>);
        } else if (feedName === 'TyreData') {
          robustMerge(state.currentTyres as unknown as Record<string, unknown>, decoded as unknown as Record<string, unknown>);
        } else if (feedName === 'TrackStatus') {
          robustMerge(state.trackStatus as unknown as Record<string, unknown>, decoded as unknown as Record<string, unknown>);
        }
      }
    }
  }
}

/**
 * DB CACHE WRITING
 */
async function writeToCache(state: RelayState, season: string) {
  const results = Object.entries(state.currentTiming.Lines || {}).map(([number, data]) => {
    const staticDriver = state.driverList[number];
    const acronym = staticDriver?.Tla || '';
    
    // PRIORITY: 1. Dynamic Map, 2. Static DriverList Map, 3. Hardcoded Fallback Map, 4. Unknown
    const driverId = state.dynamicNumberToId[number] || 
                     (acronym ? state.dynamicAcronymToId[acronym] : null) || 
                     (staticDriver ? (ACRONYM_TO_ID[acronym] || acronym.toLowerCase()) : null) ||
                     NUMBER_TO_ID[number] || 
                     `unknown_${number}`;

    const tyreInfo = (state.currentTyres.Lines?.[number] || {}) as TyreData['Lines'][string];

    return {
      driverId,
      acronym: acronym || driverId.slice(0, 3).toUpperCase(),
      position: parseInt(data.Position || '0') || 0,
      gap: data.GapToLeader || '',
      interval: data.IntervalToNext || '',
      isRetired: isTrueDnf(data.Status || '', data.NumberOfLaps || '1') || data.Retired || data.Stopped || false,
      inPit: data.InPit || false,
      number,
      tyres: {
        compound: tyreInfo.Compound || 'Unknown',
        isNew: tyreInfo.New === 'true' || tyreInfo.New === true,
        laps: tyreInfo.TyresNotChangedLaps || 0
      }
    };
  }).sort((a, b) => (a.position || 99) - (b.position || 99));

  if (results.length === 0) return;

  // Smart Finish detection
  const isFinished = state.sessionInfo.Status === 'Finished' || state.sessionInfo.Status === 'Final' || 
                    state.sessionInfo.ArchiveStatus?.Status === 'Generating';

  const simplified = {
    status: isFinished ? 'Completed' : (state.sessionInfo.Status || 'Active'),
    trackStatus: state.trackStatus.Status || '1',
    trackMessage: state.trackStatus.Message || 'Green',
    meeting: state.sessionInfo.Meeting?.Name || 'Unknown',
    session: state.sessionInfo.Session?.Name || 'Race',
    results: results,
    lastUpdated: new Date().toISOString()
  };

  await supabase.from('kv_cache').upsert({
    key: `f1_live_timing_latest_${season}`,
    value: simplified,
    updated_at: new Date().toISOString()
  });
}

/**
 * MAIN EXECUTION
 */
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const customCronHeader = req.headers.get('X-Cron-Secret');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && authHeader !== CRON_SECRET && customCronHeader !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 0. Determine Season
  const url = new URL(req.url);
  const season = url.searchParams.get('season') || new Date().getFullYear().toString();

  // 1. Per-request state to ensure concurrency safety
  const state: RelayState = {
    currentTiming: { Lines: {} },
    currentTyres: { Lines: {} },
    trackStatus: { Status: '1', Message: 'Green' },
    driverList: {},
    sessionInfo: { Status: 'Unknown', Meeting: { Name: 'Unknown' }, Session: { Name: 'Unknown' }, Type: 'Unknown' },
    dynamicNumberToId: {},
    dynamicAcronymToId: {}
  };

  try {
    await Promise.all([
      fetchOfficialDrivers(season, state.dynamicNumberToId, state.dynamicAcronymToId), 
      discoverPathAndFetchInitial(season, state)
    ]);
    const { token } = await negotiate();
    
    const wsUrl = `${SIGNALR_BASE.replace('https', 'wss')}/connect?transport=webSockets&connectionToken=${encodeURIComponent(token)}&connectionData=${encodeURIComponent(JSON.stringify([{ name: HUB_NAME }]))}&clientProtocol=1.5`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('F1 Stream Connected.');
      ws.send(JSON.stringify({ H: HUB_NAME, M: 'Subscribe', A: [['TimingData', 'TimingData.z', 'SessionInfo', 'SessionInfo.z', 'TyreData', 'TyreData.z', 'TrackStatus', 'TrackStatus.z']], I: 1 }));
      ws.send(JSON.stringify({ H: HUB_NAME, M: 'GetSessionState', A: [], I: 2 }));
    };

    ws.onmessage = (event) => {
      try { 
        const data = JSON.parse(event.data) as SignalRMessage;
        handleMessage(data, state); 
      } catch { /* ignore */ }
    };

    const interval = setInterval(() => {
      writeToCache(state, season).catch(console.error);
    }, 5000);

    // Keep alive for 59 seconds (1-minute cron cycle)
    await new Promise(resolve => setTimeout(resolve, 59000));
    
    clearInterval(interval);
    ws.close();

    return new Response(JSON.stringify({ status: 'Relay completed' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

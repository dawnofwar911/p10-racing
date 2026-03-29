// Supabase Edge Function: f1-signalr-relay
// Connects to F1 SignalR real-time stream and caches data to DB

import { createClient } from 'npm:@supabase/supabase-js@2';
import pako from 'npm:pako';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SIGNALR_BASE = 'https://livetiming.formula1.com/signalr';
const STATIC_BASE = 'https://livetiming.formula1.com/static';
const HUB_NAME = 'Streaming';

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

// Global state for the lifetime of this function execution
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentTiming: any = { Lines: {} };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let driverList: any = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sessionInfo: any = { Status: 'Unknown', Meeting: { Name: 'Unknown' }, Session: { Name: 'Unknown' } };

/**
 * PATH DISCOVERY (To get initial DriverList and SessionInfo)
 */
async function discoverPathAndFetchInitial() {
  const season = new Date().getFullYear().toString();
  const resp = await fetch(`${STATIC_BASE}/${season}/Index.json`);
  if (!resp.ok) return;
  const data = await resp.json();
  
  if (!data.Meetings) return;
  
  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedMeetings = data.Meetings.sort((a: any, b: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aStart = new Date(a.Sessions?.[0]?.StartDate || 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bStart = new Date(b.Sessions?.[0]?.StartDate || 0);
    return bStart.getTime() - aStart.getTime();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentMeeting = sortedMeetings.find((m: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return m.Sessions?.some((s: any) => {
      const start = new Date(s.StartDate);
      const diffDays = Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays < 4;
    });
  }) || sortedMeetings[0];

  const sessions = currentMeeting.Sessions || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetSession = sessions.find((s: any) => s.Type === 'Race' || s.Name === 'Race') || sessions[sessions.length - 1];

  let sessionPath = targetSession.Path;
  if (!sessionPath) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionWithPadding = sessions.find((s: any) => s.Path);
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
      const [dlResp, siResp] = await Promise.all([
        fetch(`${fullPath}DriverList.json`),
        fetch(`${fullPath}SessionInfo.json`)
      ]);
      if (dlResp.ok) driverList = await dlResp.json();
      if (siResp.ok) sessionInfo = await siResp.json();
    } catch (e) {
      console.warn("Failed to fetch initial data", e);
    }
  }
}

/**
 * SIGNALR NEGOTIATION
 */
async function negotiate() {
  const negotiateUrl = `${SIGNALR_BASE}/negotiate?connectionData=${encodeURIComponent(JSON.stringify([{ name: HUB_NAME }]))}&clientProtocol=1.5`;
  const resp = await fetch(negotiateUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'BestRacingApp/1.0',
      'Accept': 'application/json'
    }
  });
  if (!resp.ok) throw new Error(`SignalR Negotiation Failed: ${resp.status}`);
  const data = await resp.json();
  return { token: data.ConnectionToken };
}

/**
 * DECOMPRESSION & MERGING
 */
function decodeAndDecompress(base64Data: string) {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Try standard inflate first, then fall back to inflateRaw
    let decompressed;
    try {
      decompressed = pako.inflate(bytes, { to: 'string' });
    } catch (_e) { // eslint-disable-line @typescript-eslint/no-unused-vars
      decompressed = pako.inflateRaw(bytes, { to: 'string' });
    }
    
    return JSON.parse(decompressed);
  } catch (e) {
    console.error('Decompression Error Details:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && target[key]) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  Object.assign(target || {}, source);
  return target;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleMessage(msg: any) {
  // Log keep-alives and other system messages
  if (Object.keys(msg).length === 0) return;

  // 1. Handle Response to 'GetSessionState' (Result field 'R')
  if (msg.R && msg.R.TimingData) {
    console.log('Received full Session State via Result object');
    currentTiming = deepMerge(currentTiming, msg.R.TimingData);
    if (msg.R.SessionInfo) sessionInfo = deepMerge(sessionInfo, msg.R.SessionInfo);
  }
  
  // 2. Handle standard Method calls ('M')
  if (msg.M && Array.isArray(msg.M)) {
    for (const m of msg.M) {
      console.log(`Server called method: ${m.M} for feed: ${m.A?.[0]}`);
      
      // F1 uses both 'feed' and 'Receive' depending on the data type
      if (m.M === 'feed' || m.M === 'Receive') {
        const feedName = m.A[0];
        const rawData = m.A[1];
        
        if (!rawData) continue;
        const decoded = decodeAndDecompress(rawData);
        
        if (!decoded) {
          console.warn(`Failed to decode data for feed: ${feedName}`);
          continue;
        }

        if (feedName === 'TimingData') {
          console.log(`Processing TimingData update...`);
          currentTiming = deepMerge(currentTiming, decoded);
        } else if (feedName === 'SessionInfo') {
          console.log(`Processing SessionInfo update: ${decoded.Status}`);
          sessionInfo = deepMerge(sessionInfo, decoded);
        }
      }
    }
  }
}

/**
 * DB CACHE WRITING
 */
async function writeToCache() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = Object.entries(currentTiming.Lines || {}).map(([number, data]: [string, any]) => {
    const driver = driverList[number];
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

  if (results.length === 0) {
    console.log('No results to write to cache yet...');
    return;
  }

  const simplified = {
    status: sessionInfo.Status,
    meeting: sessionInfo.Meeting?.Name || 'Unknown',
    session: sessionInfo.Session?.Name || 'Unknown',
    results: results,
    lastUpdated: new Date().toISOString()
  };

  const cacheKey = `f1_live_latest_latest_latest`;
  
  console.log(`Writing ${results.length} positions to cache key: ${cacheKey}`);
  const { error } = await supabase.from('kv_cache').upsert({
    key: cacheKey,
    value: simplified,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error('Database Cache Error:', error.message);
  } else {
    console.log('Cache successfully updated.');
  }
}

/**
 * MAIN EXECUTION
 */
Deno.serve(async (req) => {
  // We only expect internal trigger from pg_cron, but secure it anyway
  const authHeader = req.headers.get('Authorization');
  const customCronHeader = req.headers.get('X-Cron-Secret');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  
  if (CRON_SECRET) {
    const expectedBearer = `Bearer ${CRON_SECRET}`;
    const isAuthorized = 
      authHeader === expectedBearer || 
      authHeader === CRON_SECRET || 
      customCronHeader === CRON_SECRET;

    if (!isAuthorized) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    await discoverPathAndFetchInitial();
    const { token } = await negotiate();
    
    const wsUrl = `${SIGNALR_BASE.replace('https', 'wss')}/connect?transport=webSockets&connectionToken=${encodeURIComponent(token)}&connectionData=${encodeURIComponent(JSON.stringify([{ name: HUB_NAME }]))}&clientProtocol=1.5`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('F1 SignalR Stream Opened. Subscribing...');
      // 1. Subscribe to live deltas
      const subMessage = { H: HUB_NAME, M: 'Subscribe', A: [['TimingData', 'SessionInfo']], I: 1 };
      ws.send(JSON.stringify(subMessage));

      // 2. Request current full state (very important for initial data)
      const stateMessage = { H: HUB_NAME, M: 'GetSessionState', A: [], I: 2 };
      ws.send(JSON.stringify(stateMessage));
    };

    ws.onmessage = (event) => {
      try { handleMessage(JSON.parse(event.data)); } catch (_e) {} // eslint-disable-line @typescript-eslint/no-unused-vars
    };

    // Keep the function alive and writing to DB for 55 seconds
    const interval = setInterval(() => {
      writeToCache().catch(console.error);
    }, 5000); // Write every 5s

    // Wait 55 seconds then shut down
    await new Promise(resolve => setTimeout(resolve, 55000));
    
    clearInterval(interval);
    ws.close();

    return new Response(JSON.stringify({ status: 'Relay execution completed' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

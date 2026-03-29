// Supabase Edge Function: f1-signalr-relay
// REAL-TIME RELAY V3: Enhanced with community proven logic
// Connects to F1 SignalR real-time stream and caches data to DB

import { createClient } from 'npm:@supabase/supabase-js@2';
import pako from 'npm:pako';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SIGNALR_BASE = 'https://livetiming.formula1.com/signalr';
const STATIC_BASE = 'https://livetiming.formula1.com/static';
const HUB_NAME = 'Streaming';

// Robust 2026 Mapping (Number -> ID)
const NUMBER_TO_ID: { [key: string]: string } = {
  '1': 'norris',
  '3': 'max_verstappen',
  '5': 'bortoleto',
  '6': 'hadjar',
  '10': 'gasly',
  '11': 'perez',
  '12': 'antonelli',
  '14': 'alonso',
  '16': 'leclerc',
  '18': 'stroll',
  '23': 'albon',
  '27': 'hulkenberg',
  '30': 'lawson',
  '31': 'ocon',
  '41': 'arvid_lindblad',
  '43': 'colapinto',
  '44': 'hamilton',
  '55': 'sainz',
  '63': 'russell',
  '77': 'bottas',
  '81': 'piastri',
  '87': 'bearman'
};

// Acronym mapping for display
const ACRONYM_TO_ID: { [key: string]: string } = {
  'NOR': 'norris',
  'VER': 'max_verstappen',
  'BOR': 'bortoleto',
  'HAD': 'hadjar',
  'GAS': 'gasly',
  'PER': 'perez',
  'ANT': 'antonelli',
  'ALO': 'alonso',
  'LEC': 'leclerc',
  'STR': 'stroll',
  'ALB': 'albon',
  'HUL': 'hulkenberg',
  'LAW': 'lawson',
  'OCO': 'ocon',
  'LIN': 'arvid_lindblad',
  'COL': 'colapinto',
  'HAM': 'hamilton',
  'SAI': 'sainz',
  'RUS': 'russell',
  'BOT': 'bottas',
  'PIA': 'piastri',
  'BEA': 'bearman'
};

// Global state for the lifetime of this function execution
/* eslint-disable @typescript-eslint/no-explicit-any */
const currentTiming: any = { Lines: {} };
let driverList: any = {};
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
  const sortedMeetings = data.Meetings.sort((a: any, b: any) => {
    const aStart = new Date(a.Sessions?.[0]?.StartDate || 0);
    const bStart = new Date(b.Sessions?.[0]?.StartDate || 0);
    return bStart.getTime() - aStart.getTime();
  });

  const currentMeeting = sortedMeetings.find((m: any) => {
    return m.Sessions?.some((s: any) => {
      const start = new Date(s.StartDate);
      const diffDays = Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays < 4;
    });
  }) || sortedMeetings[0];

  const sessions = currentMeeting.Sessions || [];
  const targetSession = sessions.find((s: any) => s.Type === 'Race' || s.Name === 'Race') || sessions[sessions.length - 1];

  let sessionPath = targetSession.Path;
  if (!sessionPath) {
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
      console.log(`Attempting to fetch initial metadata from: ${fullPath}`);
      const [dlResp, siResp] = await Promise.all([
        fetch(`${fullPath}DriverList.json`),
        fetch(`${fullPath}SessionInfo.json`)
      ]);
      if (dlResp.ok) {
        driverList = await dlResp.json();
        console.log(`DriverList loaded: ${Object.keys(driverList).length} drivers.`);
      } else {
        console.warn(`DriverList fetch failed (${dlResp.status}). Using fallback NUMBER_TO_ID map.`);
      }
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
    headers: { 'User-Agent': 'BestRacingApp/1.0', 'Accept': 'application/json' }
  });
  if (!resp.ok) throw new Error(`SignalR Negotiation Failed: ${resp.status}`);
  const data = await resp.json();
  return { token: data.ConnectionToken };
}

/**
 * DECOMPRESSION
 */
function decodeAndDecompress(base64Data: string) {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decompressed = pako.inflateRaw(bytes, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (e) {
    console.error('Decompression failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * DEEP MERGE
 */
function robustMerge(target: any, source: any) {
  if (!source) return target;
  Object.keys(source).forEach(key => {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
      robustMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  });
  return target;
}

function handleMessage(msg: any) {
  if (Object.keys(msg).length === 0) return;

  if (msg.R) {
    const timingData = msg.R.TimingData || (msg.R.Lines ? msg.R : null);
    const infoData = msg.R.SessionInfo;
    if (timingData) {
      console.log('Merging full TimingData snapshot');
      robustMerge(currentTiming, timingData);
    }
    if (infoData) robustMerge(sessionInfo, infoData);
  }
  
  if (msg.M && Array.isArray(msg.M)) {
    for (const m of msg.M) {
      if (m.M === 'feed' || m.M === 'Receive') {
        let feedName = m.A[0];
        const rawData = m.A[1];
        if (!rawData) continue;

        const isCompressed = typeof feedName === 'string' && feedName.endsWith('.z');
        if (isCompressed) feedName = feedName.slice(0, -2);

        const decoded = isCompressed ? decodeAndDecompress(rawData) : rawData;
        if (!decoded) continue;

        if (feedName === 'TimingData') {
          robustMerge(currentTiming, decoded);
        } else if (feedName === 'SessionInfo') {
          robustMerge(sessionInfo, decoded);
        }
      }
    }
  }
}

/**
 * DB CACHE WRITING
 */
async function writeToCache() {
  const results = Object.entries(currentTiming.Lines || {}).map(([number, data]: [string, any]) => {
    const driver = driverList[number];
    const acronym = driver?.Tla || '';
    
    // FALLBACK: If driverList failed (403), use our static mapping
    const driverId = driverList[number] 
      ? (ACRONYM_TO_ID[acronym] || acronym.toLowerCase())
      : (NUMBER_TO_ID[number] || `unknown_${number}`);

    return {
      driverId,
      acronym: acronym || driverId.slice(0, 3).toUpperCase(),
      position: parseInt(data.Position) || 0,
      gap: data.GapToLeader || '',
      interval: data.IntervalToNext || '',
      isRetired: data.Retired || data.Stopped || false,
      inPit: data.InPit || false,
      number
    };
  }).sort((a, b) => (a.position || 99) - (b.position || 99));

  if (results.length === 0) return;

  const simplified = {
    status: sessionInfo.Status || 'Active',
    meeting: sessionInfo.Meeting?.Name || 'Japanese Grand Prix',
    session: sessionInfo.Session?.Name || 'Race',
    results: results,
    lastUpdated: new Date().toISOString()
  };

  const { error } = await supabase.from('kv_cache').upsert({
    key: `f1_live_latest_latest_latest`,
    value: simplified,
    updated_at: new Date().toISOString()
  });
  
  if (!error) console.log(`Cache updated: ${results.length} drivers mapped using ${Object.keys(driverList).length > 0 ? 'DriverList' : 'NUMBER_TO_ID fallback'}.`);
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

  try {
    await discoverPathAndFetchInitial();
    const { token } = await negotiate();
    
    const wsUrl = `${SIGNALR_BASE.replace('https', 'wss')}/connect?transport=webSockets&connectionToken=${encodeURIComponent(token)}&connectionData=${encodeURIComponent(JSON.stringify([{ name: HUB_NAME }]))}&clientProtocol=1.5`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('F1 Stream Connected. Subscribing...');
      ws.send(JSON.stringify({ H: HUB_NAME, M: 'Subscribe', A: [['TimingData', 'TimingData.z', 'SessionInfo', 'SessionInfo.z']], I: 1 }));
      ws.send(JSON.stringify({ H: HUB_NAME, M: 'GetSessionState', A: [], I: 2 }));
    };

    ws.onmessage = (event) => {
      try { handleMessage(JSON.parse(event.data)); } catch { /* ignore */ }
    };

    const interval = setInterval(() => {
      writeToCache().catch(console.error);
    }, 5000);

    // Stay alive for 59 seconds to support a 1-minute cron cycle
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
/* eslint-enable @typescript-eslint/no-explicit-any */

// Supabase Edge Function: f1-signalr-relay
//
// Relays the public F1 live timing stream (SignalR Core) into kv_cache so that
// f1-live-proxy and the app can show the live running order around P10, DNFs,
// tyres and track status during a Race or Sprint.
//
// History: the legacy ASP.NET SignalR endpoint (/signalr, clientProtocol 1.5,
// hub "Streaming") was switched off by F1 in May 2025 and now answers 401. This
// version speaks SignalR Core (/signalrcore) with the JSON hub protocol.
//
// Design:
//   * Invoked every minute by pg_cron, but the cron job itself is gated in SQL on
//     the kv_cache row `f1_live_window`, so no HTTP call happens outside a race
//     or sprint window (see supabase/migrations/*_f1_relay_live_window_gate.sql).
//   * Before opening any socket the function checks again that a Race/Sprint is
//     actually live (static SessionInfo.json, falling back to the Jolpica
//     schedule). If not, it returns 204 immediately.
//   * When live, it holds one socket for ~55 s and upserts
//     `f1_live_timing_latest_<season>` only when the payload changed (or every
//     30 s as a heartbeat for the app's staleness check).
//   * When the session is Finished/Finalised it writes the final state and
//     closes the live window so the cron gate stops firing.
//
// Query params (all require the cron secret):
//   ?season=YYYY   override season (defaults to current UTC year)
//   ?force=1       skip the live-session check (testing)
//   ?dry=1         do not write to the DB; return the payload that would be
//                  written as JSON (testing; works outside a live session too,
//                  as F1 replays the last session's snapshot on Subscribe)
//   ?seconds=N     how long to hold the socket (default 55, max 140)

import { createClient } from 'npm:@supabase/supabase-js@2';
import pako from 'npm:pako@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORE_NEGOTIATE_URL = 'https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1';
const CORE_WS_URL = 'wss://livetiming.formula1.com/signalrcore';
const STATIC_SESSION_INFO_URL = 'https://livetiming.formula1.com/static/SessionInfo.json';
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const RECORD_SEP = '\x1e';

// Public topics only. Auth-gated topics (CarData.z, Position.z, DriverRaceInfo,
// PitStopSeries, ChampionshipPrediction, ...) are deliberately not requested.
// Tyre stints arrive inside TimingAppData.Lines[n].Stints in SignalR Core.
const TOPICS = [
  'TimingData',
  'TimingAppData',
  'SessionInfo',
  'SessionStatus',
  'TrackStatus',
  'DriverList',
  'LapCount',
];

const LIVE_WINDOW_KEY = 'f1_live_window';
const PRE_START_MS = 10 * 60 * 1000;        // open 10 min before lights out
const POST_END_MS = 30 * 60 * 1000;         // keep 30 min after scheduled end
const FALLBACK_DURATION_MS = 2 * 60 * 60 * 1000; // assumed race length when only a start time is known
const WRITE_INTERVAL_MS = 5000;
const HEARTBEAT_WRITE_MS = 30000;
const FINISHED_STATUSES = new Set(['Finished', 'Finalised', 'Ends']);

// Supabase Edge Runtime global (background tasks). Optional so local deno runs work.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return null;
    // livetiming static files start with a UTF-8 BOM
    const text = (await resp.text()).replace(/^\uFEFF/, '');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types (only the fields we use)
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

interface TimingLine {
  Position?: string;
  GapToLeader?: string | { Value?: string };
  IntervalToPositionAhead?: { Value?: string; Catching?: boolean };
  IntervalToNext?: string; // legacy name, kept as a fallback
  Stopped?: boolean;
  InPit?: boolean;
  Retired?: boolean;
  Status?: string | number;
  NumberOfLaps?: string | number;
  [key: string]: unknown;
}

interface Stint {
  Compound?: string;
  New?: string | boolean;
  TotalLaps?: number;
  TyresNotChanged?: string;
  [key: string]: unknown;
}

interface SessionInfo {
  Meeting?: { Name?: string; [key: string]: unknown };
  Name?: string;
  Type?: string;
  StartDate?: string;
  EndDate?: string;
  GmtOffset?: string;
  SessionStatus?: string;
  ArchiveStatus?: { Status?: string };
  Path?: string;
  [key: string]: unknown;
}

interface RelayState {
  timing: { Lines: Record<string, TimingLine> };
  appData: { Lines: Record<string, { Stints?: Stint[] | Record<string, Stint>; [key: string]: unknown }> };
  sessionInfo: SessionInfo;
  sessionStatus: { Status?: string; [key: string]: unknown };
  trackStatus: { Status?: string; Message?: string };
  driverList: Record<string, { Tla?: string; [key: string]: unknown }>;
  lapCount: { CurrentLap?: number; TotalLaps?: number };
  dynamicNumberToId: Record<string, string>;
  dynamicAcronymToId: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Driver mapping (unchanged behaviour)
// ---------------------------------------------------------------------------

// Robust 2026 Mapping (Number -> ID)
const NUMBER_TO_ID: { [key: string]: string } = {
  '1': 'norris', '3': 'max_verstappen', '5': 'bortoleto', '6': 'hadjar',
  '10': 'gasly', '11': 'perez', '12': 'antonelli', '14': 'alonso',
  '16': 'leclerc', '18': 'stroll', '23': 'albon', '27': 'hulkenberg',
  '30': 'lawson', '31': 'ocon', '41': 'arvid_lindblad', '43': 'colapinto',
  '44': 'hamilton', '55': 'sainz', '63': 'russell', '77': 'bottas',
  '81': 'piastri', '87': 'bearman'
};

const ACRONYM_TO_ID: { [key: string]: string } = {
  'NOR': 'norris', 'VER': 'max_verstappen', 'BOR': 'bortoleto', 'HAD': 'hadjar',
  'GAS': 'gasly', 'PER': 'perez', 'ANT': 'antonelli', 'ALO': 'alonso',
  'LEC': 'leclerc', 'STR': 'stroll', 'ALB': 'albon', 'HUL': 'hulkenberg',
  'LAW': 'lawson', 'OCO': 'ocon', 'LIN': 'arvid_lindblad', 'COL': 'colapinto',
  'HAM': 'hamilton', 'SAI': 'sainz', 'RUS': 'russell', 'BOT': 'bottas',
  'PIA': 'piastri', 'BEA': 'bearman'
};

const GLOBAL_DRIVER_CACHE: Record<string, {
  numberMap: Record<string, string>;
  acronymMap: Record<string, string>;
  expires: number;
}> = {};

async function fetchOfficialDrivers(
  season: string,
  numberMap: Record<string, string>,
  acronymMap: Record<string, string>
) {
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
      if (d.permanentNumber) newNumberMap[d.permanentNumber] = d.driverId;
      if (d.code) newAcronymMap[d.code] = d.driverId;
    });
    Object.assign(numberMap, newNumberMap);
    Object.assign(acronymMap, newAcronymMap);
    GLOBAL_DRIVER_CACHE[season] = { numberMap: newNumberMap, acronymMap: newAcronymMap, expires: Date.now() + 3600000 };
  } catch (e) {
    console.warn('Failed to fetch official drivers', e);
  }
}

/**
 * True DNF from a textual classification status. TimingData.Lines[n].Status in
 * the live feed is a numeric bit field (e.g. 80), not a classification string,
 * so numeric values are ignored here (they previously made every car with laps
 * look retired). Live DNFs come from the Retired / Stopped flags.
 */
function isTrueDnf(status: string | number | undefined, laps: string | number = '1'): boolean {
  if (status === undefined || status === null || typeof status === 'number' || /^\d+$/.test(String(status))) {
    return false;
  }
  const s = String(status).toLowerCase();
  if (!s) return false;
  const isFinished = s === 'finished' || s.includes('lap');
  const isDns = s.includes('not start') || s === 'dns' || s.includes('qualify') || s.includes('withdrawn');
  const lapCount = typeof laps === 'string' ? parseInt(laps) : laps;
  return !isFinished && !isDns && lapCount > 0;
}

// ---------------------------------------------------------------------------
// Live-session check (runs before any socket is opened)
// ---------------------------------------------------------------------------

function isRaceLike(si: SessionInfo | null | undefined): boolean {
  if (!si) return false;
  const name = String(si.Name || '');
  // Sprints are published with Type "Race" and Name "Sprint"; exclude sprint qualifying/shootout.
  if (/qualif|shootout/i.test(name)) return false;
  return si.Type === 'Race' || /^sprint$/i.test(name) || name === 'Race';
}

/** livetiming dates are local track time without zone + GmtOffset like "-06:00:00". */
function toUtcMs(localDate: string | undefined, gmtOffset: string | undefined): number | null {
  if (!localDate) return null;
  const base = Date.parse(`${localDate.replace(/Z$/, '')}Z`);
  if (Number.isNaN(base)) return null;
  const m = /^(-)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(gmtOffset || '00:00:00');
  if (!m) return base;
  const offsetMs = ((+m[2]) * 3600 + (+m[3]) * 60 + (+(m[4] || 0))) * 1000 * (m[1] ? -1 : 1);
  return base - offsetMs;
}

interface LiveCheck { live: boolean; reason: string; }

async function checkLiveSession(season: string, now = Date.now()): Promise<LiveCheck> {
  const si = await fetchJson<SessionInfo>(STATIC_SESSION_INFO_URL);

  if (si && isRaceLike(si)) {
    const start = toUtcMs(si.StartDate, si.GmtOffset);
    const end = toUtcMs(si.EndDate, si.GmtOffset) ?? (start !== null ? start + FALLBACK_DURATION_MS : null);
    if (si.SessionStatus === 'Finalised' || si.ArchiveStatus?.Status === 'Complete') {
      return { live: false, reason: `${si.Name} finalised` };
    }
    if (start !== null && end !== null && now >= start - PRE_START_MS && now <= end + POST_END_MS) {
      return { live: true, reason: `${si.Meeting?.Name} ${si.Name} (SessionInfo)` };
    }
  }

  // Fallback: Jolpica schedule. SessionInfo.json may still point at the previous
  // session shortly before lights out.
  const cal = await fetchJson<{ MRData?: { RaceTable?: { Races?: Array<{ raceName: string; date: string; time?: string; Sprint?: { date: string; time?: string } }> } } }>(
    `${JOLPICA_BASE}/${season}.json`
  );
  for (const r of cal?.MRData?.RaceTable?.Races || []) {
    const sessions: Array<[string, string, string | undefined]> = [[`${r.raceName} Race`, r.date, r.time]];
    if (r.Sprint) sessions.push([`${r.raceName} Sprint`, r.Sprint.date, r.Sprint.time]);
    for (const [label, date, time] of sessions) {
      if (!time) continue;
      const start = Date.parse(`${date}T${time}`);
      if (Number.isNaN(start)) continue;
      if (now >= start - PRE_START_MS && now <= start + FALLBACK_DURATION_MS + POST_END_MS) {
        // Don't reopen a session that SessionInfo already reports as finalised.
        if (si && isRaceLike(si) && (si.SessionStatus === 'Finalised' || si.ArchiveStatus?.Status === 'Complete')) {
          const siStart = toUtcMs(si.StartDate, si.GmtOffset);
          if (siStart !== null && Math.abs(siStart - start) < 3 * 3600000) continue;
        }
        return { live: true, reason: `${label} (schedule)` };
      }
    }
  }
  return { live: false, reason: 'no race or sprint live' };
}

// ---------------------------------------------------------------------------
// SignalR Core
// ---------------------------------------------------------------------------

async function negotiate(): Promise<{ token: string; cookie: string }> {
  const resp = await fetchWithTimeout(CORE_NEGOTIATE_URL, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'User-Agent': 'P10Racing/2.0' },
  });
  if (!resp.ok) throw new Error(`SignalR Core negotiate failed: ${resp.status}`);
  // Load-balancer stickiness cookies must be sent on the websocket upgrade.
  const cookie = resp.headers.getSetCookie()
    .map((c) => c.split(';')[0].trim())
    .filter((c) => /^AWSALB(CORS)?=/.test(c))
    .join('; ');
  const data = await resp.json();
  const token = data.connectionToken || data.ConnectionToken;
  if (!token) throw new Error('SignalR Core negotiate returned no connectionToken');
  return { token, cookie };
}

function decodeAndDecompress(base64Data: string): unknown {
  try {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(pako.inflateRaw(bytes, { to: 'string' }));
  } catch {
    return null;
  }
}

/** Deep merge of F1 delta updates. Arrays are merged by index (stint updates arrive as {"2": {...}}). */
function robustMerge(target: Json, source: Json): Json {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (key === '_kf') continue;
    const value = source[key];
    const existing = target[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object') {
      robustMerge(existing as Json, value as Json);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function applyTopic(topic: string, payload: unknown, state: RelayState) {
  let name = topic;
  let data = payload;
  if (name.endsWith('.z')) {
    name = name.slice(0, -2);
    data = typeof payload === 'string' ? decodeAndDecompress(payload) : null;
  }
  if (!data || typeof data !== 'object') return;
  const d = data as Json;
  switch (name) {
    case 'TimingData': robustMerge(state.timing as unknown as Json, d); break;
    case 'TimingAppData': robustMerge(state.appData as unknown as Json, d); break;
    case 'SessionInfo': robustMerge(state.sessionInfo as Json, d); break;
    case 'SessionStatus': robustMerge(state.sessionStatus as Json, d); break;
    case 'TrackStatus': robustMerge(state.trackStatus as Json, d); break;
    case 'DriverList': robustMerge(state.driverList as Json, d); break;
    case 'LapCount': robustMerge(state.lapCount as Json, d); break;
  }
}

/** Handle one SignalR Core record. Returns false when the server closed the hub. */
function handleRecord(rec: Json, state: RelayState, ws: WebSocket): boolean {
  switch (rec.type) {
    case 1: // Invocation: {"type":1,"target":"feed","arguments":[topic, data, timestamp]}
      if (rec.target === 'feed' && Array.isArray(rec.arguments)) {
        const [topic, data] = rec.arguments as [string, unknown];
        if (typeof topic === 'string') applyTopic(topic, data, state);
      }
      return true;
    case 3: // Completion of Subscribe: result is the snapshot { topic: data }
      if (rec.error) console.warn('Subscribe error:', rec.error);
      if (rec.result && typeof rec.result === 'object') {
        for (const [topic, data] of Object.entries(rec.result as Json)) applyTopic(topic, data, state);
      }
      return true;
    case 6: // Ping -> pong
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 6 }) + RECORD_SEP);
      return true;
    case 7: // Close
      console.warn('SignalR Core server closed the connection:', rec.error ?? '(no error)');
      return false;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Payload (shape consumed by f1-live-proxy and lib/hooks/use-f1-live-timing.ts)
// ---------------------------------------------------------------------------

function currentStint(stints: Stint[] | Record<string, Stint> | undefined): Stint {
  if (!stints) return {};
  if (Array.isArray(stints)) {
    for (let i = stints.length - 1; i >= 0; i--) if (stints[i]) return stints[i];
    return {};
  }
  const keys = Object.keys(stints).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  return keys.length ? stints[String(keys[keys.length - 1])] || {} : {};
}

function textValue(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return String((v as { Value?: unknown }).Value ?? '');
  return String(v);
}

function isSessionFinished(state: RelayState): boolean {
  return FINISHED_STATUSES.has(state.sessionStatus.Status || '') ||
    state.sessionInfo.SessionStatus === 'Finished' ||
    state.sessionInfo.SessionStatus === 'Finalised' ||
    state.sessionInfo.ArchiveStatus?.Status === 'Generating' ||
    state.sessionInfo.ArchiveStatus?.Status === 'Complete';
}

function buildPayload(state: RelayState) {
  const results = Object.entries(state.timing.Lines || {}).map(([number, data]) => {
    const staticDriver = state.driverList[number];
    const acronym = staticDriver?.Tla || '';

    // PRIORITY: 1. Dynamic Map, 2. DriverList acronym, 3. Hardcoded Fallback Map, 4. Unknown
    const driverId = state.dynamicNumberToId[number] ||
                     (acronym ? state.dynamicAcronymToId[acronym] : null) ||
                     (staticDriver && acronym ? (ACRONYM_TO_ID[acronym] || acronym.toLowerCase()) : null) ||
                     NUMBER_TO_ID[number] ||
                     `unknown_${number}`;

    const stint = currentStint(state.appData.Lines?.[number]?.Stints);

    return {
      driverId,
      acronym: acronym || driverId.slice(0, 3).toUpperCase(),
      position: parseInt(String(data.Position || '0')) || 0,
      gap: textValue(data.GapToLeader),
      interval: textValue(data.IntervalToPositionAhead) || textValue(data.IntervalToNext),
      isRetired: isTrueDnf(data.Status, data.NumberOfLaps ?? '1') || data.Retired === true || data.Stopped === true,
      inPit: data.InPit === true,
      number,
      tyres: {
        compound: stint.Compound || 'Unknown',
        isNew: stint.New === 'true' || stint.New === true,
        laps: typeof stint.TotalLaps === 'number' ? stint.TotalLaps : parseInt(String(stint.TotalLaps ?? '0')) || 0,
      },
    };
  }).sort((a, b) => (a.position || 99) - (b.position || 99));

  const finished = isSessionFinished(state);

  return {
    status: finished ? 'Completed' : (state.sessionStatus.Status || state.sessionInfo.SessionStatus || 'Active'),
    trackStatus: String(state.trackStatus.Status || '1'),
    trackMessage: state.trackStatus.Message || 'Green',
    meeting: state.sessionInfo.Meeting?.Name || 'Unknown',
    session: state.sessionInfo.Name || 'Race',
    // Additive, optional fields (ignored by current consumers)
    currentLap: state.lapCount.CurrentLap ?? null,
    totalLaps: state.lapCount.TotalLaps ?? null,
    results,
    lastUpdated: new Date().toISOString(),
  };
}

type Payload = ReturnType<typeof buildPayload>;

async function writeToCache(payload: Payload, season: string) {
  const { error } = await supabase.from('kv_cache').upsert({
    key: `f1_live_timing_latest_${season}`,
    value: payload,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('kv_cache upsert failed:', error.message);
}

/** Close the SQL cron gate early once the session is over. */
async function closeLiveWindow() {
  const { data } = await supabase.from('kv_cache').select('value').eq('key', LIVE_WINDOW_KEY).maybeSingle();
  const value = (data?.value || {}) as { windows?: Array<{ start: string; end: string; closedAt?: string }> };
  if (!Array.isArray(value.windows)) return;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let changed = false;
  for (const w of value.windows) {
    if (Date.parse(w.start) <= now && now < Date.parse(w.end)) {
      w.end = nowIso;
      w.closedAt = nowIso;
      changed = true;
    }
  }
  if (changed) {
    await supabase.from('kv_cache').upsert({ key: LIVE_WINDOW_KEY, value, updated_at: nowIso });
    console.log('Session finished: live window closed.');
  }
}

// ---------------------------------------------------------------------------
// Relay run
// ---------------------------------------------------------------------------

interface RunOptions { season: string; dry: boolean; seconds: number; }

async function runRelay({ season, dry, seconds }: RunOptions): Promise<{ payload: Payload | null; writes: number; finished: boolean }> {
  const state: RelayState = {
    timing: { Lines: {} },
    appData: { Lines: {} },
    sessionInfo: {},
    sessionStatus: {},
    trackStatus: { Status: '1', Message: 'Green' },
    driverList: {},
    lapCount: {},
    dynamicNumberToId: {},
    dynamicAcronymToId: {},
  };

  const [{ token, cookie }] = await Promise.all([
    negotiate(),
    fetchOfficialDrivers(season, state.dynamicNumberToId, state.dynamicAcronymToId),
  ]);

  const wsUrl = `${CORE_WS_URL}?id=${encodeURIComponent(token)}`;
  // Deno's WebSocket accepts a non-standard `headers` option, used here to send
  // the AWSALB/AWSALBCORS stickiness cookies captured during negotiate.
  const ws = new WebSocket(wsUrl, { headers: cookie ? { Cookie: cookie } : {} } as unknown as string[]);

  let handshakeDone = false;
  let closed = false;
  let buffer = '';
  const closedPromise = new Promise<void>((resolve) => {
    ws.onclose = () => { closed = true; resolve(); };
  });

  ws.onopen = () => ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEP);
  ws.onerror = (e) => console.warn('WebSocket error:', (e as ErrorEvent).message ?? e);
  ws.onmessage = async (event) => {
    const chunk = typeof event.data === 'string'
      ? event.data
      : new TextDecoder().decode(event.data instanceof Blob ? await event.data.arrayBuffer() : event.data);
    buffer += chunk;
    const parts = buffer.split(RECORD_SEP);
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      if (!part.trim()) continue;
      let rec: Json;
      try { rec = JSON.parse(part); } catch { continue; }
      if (!handshakeDone) {
        handshakeDone = true;
        if (rec.error) {
          console.error('SignalR Core handshake error:', rec.error);
          ws.close();
          return;
        }
        ws.send(JSON.stringify({ type: 1, invocationId: '0', target: 'Subscribe', arguments: [TOPICS] }) + RECORD_SEP);
        console.log('SignalR Core connected and subscribed.');
        continue;
      }
      if (!handleRecord(rec, state, ws)) ws.close();
    }
  };

  let lastSerialized = '';
  let lastWriteAt = 0;
  let writes = 0;
  let latest: Payload | null = null;
  let finished = false;

  const flush = async (force = false) => {
    // Only publish Race/Sprint data. Before lights out F1 can still be serving
    // the previous session (e.g. qualifying) and that must not overwrite the cache.
    if (!isRaceLike(state.sessionInfo)) return;
    const payload = buildPayload(state);
    if (payload.results.length === 0) return;
    latest = payload;
    finished = payload.status === 'Completed';
    const { lastUpdated: _ignored, ...comparable } = payload;
    const serialized = JSON.stringify(comparable);
    const due = Date.now() - lastWriteAt >= HEARTBEAT_WRITE_MS;
    if (!force && serialized === lastSerialized && !due) return;
    lastSerialized = serialized;
    lastWriteAt = Date.now();
    writes++;
    if (!dry) await writeToCache(payload, season);
  };

  const deadline = Date.now() + seconds * 1000;
  while (!closed && Date.now() < deadline) {
    await Promise.race([new Promise((r) => setTimeout(r, WRITE_INTERVAL_MS)), closedPromise]);
    await flush().catch((e) => console.error('flush failed', e));
    if (finished) break;
  }
  await flush(true).catch((e) => console.error('final flush failed', e));

  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();

  if (finished && !dry) await closeLiveWindow().catch((e) => console.warn('closeLiveWindow failed', e));

  if (!latest) {
    console.log(`No race data published. Session seen: ${state.sessionInfo.Type ?? '?'} / ${state.sessionInfo.Name ?? '?'}`);
  }
  return { payload: latest, writes, finished };
}

// ---------------------------------------------------------------------------
// HTTP entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const customCronHeader = req.headers.get('X-Cron-Secret');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && authHeader !== CRON_SECRET && customCronHeader !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const season = url.searchParams.get('season') || new Date().getUTCFullYear().toString();
  const force = url.searchParams.get('force') === '1';
  const dry = url.searchParams.get('dry') === '1';
  const seconds = Math.min(Math.max(parseInt(url.searchParams.get('seconds') || '55') || 55, 5), 140);

  // 1. No socket unless a Race/Sprint is live.
  if (!force) {
    const check = await checkLiveSession(season);
    if (!check.live) return new Response(null, { status: 204 });
    console.log(`Live: ${check.reason}`);
  }

  // 2. Dry runs answer with the payload (for testing).
  if (dry) {
    try {
      const result = await runRelay({ season, dry: true, seconds });
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
    }
  }

  // 3. Live run: answer the cron caller straight away (keeps pg_net's response
  //    small and fast) and keep relaying in the background.
  const work = runRelay({ season, dry: false, seconds })
    .then((r) => console.log(`Relay done: ${r.writes} writes, finished=${r.finished}`))
    .catch((err) => console.error('Relay failed:', err instanceof Error ? err.message : err));

  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
    return new Response(null, { status: 202 });
  }
  await work;
  return new Response(null, { status: 202 });
});

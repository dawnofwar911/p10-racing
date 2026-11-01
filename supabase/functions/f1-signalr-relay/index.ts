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

// Only the topics the app's Live Race Center reads (components/LiveRaceCenter.tsx
// via lib/hooks/use-f1-live-timing.ts): running order, gaps/intervals, retired
// and in-pit flags (TimingData), driver acronyms (DriverList), current tyre
// compound/age (TimingAppData stints), the track status banner (TrackStatus),
// and session status/name for the Race/Sprint guard and finish detection
// (SessionStatus, SessionInfo). Everything else (CarData.z, Position.z car
// coordinates, LapCount, TyreStintSeries, RaceControlMessages, WeatherData,
// TimingStats, ...) is deliberately not requested.
const TOPICS = [
  'TimingData',
  'DriverList',
  'TimingAppData',
  'TrackStatus',
  'SessionStatus',
  'SessionInfo',
];

const LIVE_WINDOW_KEY = 'f1_live_window';
const PRE_START_MS = 10 * 60 * 1000;        // open 10 min before lights out
const POST_END_MS = 30 * 60 * 1000;         // keep 30 min after scheduled end
const MAX_AFTER_START_MS = 4 * 60 * 60 * 1000;  // matches the SQL gate: 3h max race time + delayed-start margin
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
  // P10 Racing only scores Grand Prix races. Sprints are published with
  // Type "Race" and Name "Sprint", so exclude anything sprint/qualifying.
  if (/qualif|shootout|sprint/i.test(name)) return false;
  return si.Type === 'Race' && name === 'Race';
}

/**
 * Map F1's TrackStatus codes onto the codes the app's banner uses.
 * F1: 1 AllClear, 2 Yellow, 4 SCDeployed, 5 Red, 6 VSCDeployed, 7 VSCEnding.
 * App (LiveRaceCenter getTrackStatusColor): 1 green, 2 yellow, 4 SC, 5 VSC,
 * 6 VSC ending, 3 red. F1 can leave TrackStatus on Yellow during a red flag,
 * so SessionStatus "Aborted" (the red-flag suspension) always wins as Red.
 */
function appTrackStatus(state: RelayState): { trackStatus: string; trackMessage: string } {
  const sess = String(state.sessionStatus.Status || '');
  if (/^aborted$/i.test(sess)) return { trackStatus: '3', trackMessage: 'Red Flag' };
  const code = String(state.trackStatus.Status || '1');
  const msg = state.trackStatus.Message;
  switch (code) {
    case '1': return { trackStatus: '1', trackMessage: msg || 'Green' };
    case '2': return { trackStatus: '2', trackMessage: msg || 'Yellow' };
    case '4': return { trackStatus: '4', trackMessage: 'Safety Car' };
    case '5': return { trackStatus: '3', trackMessage: 'Red Flag' };
    case '6': return { trackStatus: '5', trackMessage: 'Virtual Safety Car' };
    case '7': return { trackStatus: '6', trackMessage: 'VSC Ending' };
    default: return { trackStatus: code, trackMessage: msg || 'Track Status Change' };
  }
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
    // EndDate is the scheduled end; a delayed start or red flags can run past it,
    // so allow up to MAX_AFTER_START_MS after the start (finish detection closes it early).
    const schedEnd = toUtcMs(si.EndDate, si.GmtOffset);
    const end = start !== null ? Math.max(start + MAX_AFTER_START_MS, (schedEnd ?? 0) + POST_END_MS) : schedEnd;
    if (si.SessionStatus === 'Finalised' || si.ArchiveStatus?.Status === 'Complete') {
      return { live: false, reason: `${si.Name} finalised` };
    }
    if (start !== null && end !== null && now >= start - PRE_START_MS && now <= end) {
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
    for (const [label, date, time] of sessions) {
      if (!time) continue;
      const start = Date.parse(`${date}T${time}`);
      if (Number.isNaN(start)) continue;
      if (now >= start - PRE_START_MS && now <= start + MAX_AFTER_START_MS) {
        // Don't reopen a session that SessionInfo already reports as finalised.
        if (si && isRaceLike(si) && (si.SessionStatus === 'Finalised' || si.ArchiveStatus?.Status === 'Complete')) {
          const siStart = toUtcMs(si.StartDate, si.GmtOffset);
          if (siStart !== null && Math.abs(siStart - start) < 3 * 3600000) continue;
        }
        return { live: true, reason: `${label} (schedule)` };
      }
    }
  }
  return { live: false, reason: 'no grand prix race live' };
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

/**
 * Negotiate and open the websocket, retrying with a fresh negotiate when the
 * upgrade lands on a different backend than negotiate (F1's load balancer then
 * answers 400). Deno accepts a non-standard `headers` option to send the
 * AWSALB stickiness cookies, but the Supabase Edge Runtime rejects it
 * ("Invalid protocol value"), so fall back to a plain WebSocket there.
 */
type WsEvent = { data?: unknown; message?: string };
interface WsLike {
  readyState: number;
  onopen: ((e: WsEvent) => void) | null;
  onmessage: ((e: WsEvent) => void) | null;
  onerror: ((e: WsEvent) => void) | null;
  onclose: ((e: WsEvent) => void) | null;
  send(data: string): void;
  close(): void;
}

/**
 * Minimal RFC 6455 client over a raw TLS socket. Supabase's Edge Runtime
 * rejects the WebSocket `headers` option, and F1's AWS load balancer answers
 * 400 to the upgrade unless it carries the AWSALB stickiness cookie from
 * negotiate (the connection token only exists on the node that issued it).
 * This lets us send the Cookie header ourselves.
 */
class RawWebSocket implements WsLike {
  readyState = 0;
  onopen: ((e: WsEvent) => void) | null = null;
  onmessage: ((e: WsEvent) => void) | null = null;
  onerror: ((e: WsEvent) => void) | null = null;
  onclose: ((e: WsEvent) => void) | null = null;
  private conn: Deno.TlsConn | null = null;
  private writeChain: Promise<unknown> = Promise.resolve();
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  static async open(url: string, cookie: string, timeoutMs = 8000): Promise<RawWebSocket> {
    const u = new URL(url);
    const ws = new RawWebSocket();
    const conn = await Deno.connectTls({ hostname: u.hostname, port: Number(u.port) || 443 });
    ws.conn = conn;
    const keyBytes = crypto.getRandomValues(new Uint8Array(16));
    const key = btoa(String.fromCharCode(...keyBytes));
    const req = [
      `GET ${u.pathname}${u.search} HTTP/1.1`,
      `Host: ${u.host}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      'User-Agent: P10Racing/2.0',
      'Origin: https://www.formula1.com',
      ...(cookie ? [`Cookie: ${cookie}`] : []),
      '', '',
    ].join('\r\n');
    await conn.write(ws.enc.encode(req));
    // Read the HTTP response head.
    let buf: Uint8Array = new Uint8Array(0);
    const deadline = Date.now() + timeoutMs;
    let headEnd = -1;
    while (headEnd < 0) {
      if (Date.now() > deadline) { try { conn.close(); } catch { /* */ } throw new Error('websocket upgrade timeout'); }
      const chunk = new Uint8Array(16384);
      const n = await conn.read(chunk);
      if (n === null) throw new Error('websocket upgrade: connection closed');
      buf = concatBytes(buf, chunk.subarray(0, n));
      headEnd = indexOfCrlfCrlf(buf);
    }
    const head = ws.dec.decode(buf.subarray(0, headEnd));
    const status = head.split('\r\n')[0];
    if (!/^HTTP\/1\.1 101/.test(status)) { try { conn.close(); } catch { /* */ } throw new Error(`websocket upgrade failed: ${status}`); }
    ws.readyState = 1;
    ws.readLoop(buf.subarray(headEnd + 4));
    return ws;
  }

  private async readLoop(initial: Uint8Array) {
    let buf: Uint8Array = initial;
    let fragments: Uint8Array[] = [];
    let fragOpcode = 0;
    try {
      while (true) {
        // Parse as many whole frames as the buffer holds.
        while (true) {
          if (buf.length < 2) break;
          const b0 = buf[0], b1 = buf[1];
          const fin = (b0 & 0x80) !== 0;
          const opcode = b0 & 0x0f;
          const masked = (b1 & 0x80) !== 0;
          let len = b1 & 0x7f;
          let off = 2;
          if (len === 126) { if (buf.length < 4) break; len = (buf[2] << 8) | buf[3]; off = 4; }
          else if (len === 127) {
            if (buf.length < 10) break;
            len = 0; for (let i = 2; i < 10; i++) len = len * 256 + buf[i];
            off = 10;
          }
          let mask: Uint8Array | null = null;
          if (masked) { if (buf.length < off + 4) break; mask = buf.subarray(off, off + 4); off += 4; }
          if (buf.length < off + len) break;
          const payload = buf.slice(off, off + len);
          if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
          buf = buf.subarray(off + len);
          if (opcode === 0x8) { this.finish(); return; }
          if (opcode === 0x9) { this.writeFrame(0xA, payload); continue; }
          if (opcode === 0xA) continue;
          if (opcode === 0x1 || opcode === 0x2) { fragments = [payload]; fragOpcode = opcode; }
          else if (opcode === 0x0) fragments.push(payload);
          if (fin && (opcode <= 0x2)) {
            const whole = fragments.length === 1 ? fragments[0] : fragments.reduce(concatBytes, new Uint8Array(0));
            fragments = [];
            const data = fragOpcode === 0x1 ? this.dec.decode(whole) : whole;
            try { this.onmessage?.({ data }); } catch (e) { console.warn('onmessage threw', e); }
          }
        }
        const chunk = new Uint8Array(65536);
        const n = await this.conn!.read(chunk);
        if (n === null) break;
        buf = buf.length ? concatBytes(buf, chunk.subarray(0, n)) : chunk.slice(0, n);
      }
    } catch (e) {
      if (this.readyState !== 3) this.onerror?.({ message: e instanceof Error ? e.message : String(e) });
    }
    this.finish();
  }

  private writeFrame(opcode: number, payload: Uint8Array) {
    const len = payload.length;
    const headerLen = len < 126 ? 2 : len < 65536 ? 4 : 10;
    const frame = new Uint8Array(headerLen + 4 + len);
    frame[0] = 0x80 | opcode;
    if (len < 126) frame[1] = 0x80 | len;
    else if (len < 65536) { frame[1] = 0x80 | 126; frame[2] = len >> 8; frame[3] = len & 0xff; }
    else { frame[1] = 0x80 | 127; let l = len; for (let i = 9; i >= 2; i--) { frame[i] = l & 0xff; l = Math.floor(l / 256); } }
    const mask = crypto.getRandomValues(new Uint8Array(4));
    frame.set(mask, headerLen);
    for (let i = 0; i < len; i++) frame[headerLen + 4 + i] = payload[i] ^ mask[i & 3];
    const conn = this.conn!;
    this.writeChain = this.writeChain.then(async () => {
      let written = 0;
      while (written < frame.length) written += await conn.write(frame.subarray(written));
    }).catch((e) => console.warn('websocket write failed', e));
  }

  send(data: string) {
    if (this.readyState !== 1) return;
    this.writeFrame(0x1, this.enc.encode(data));
  }

  close() {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    this.writeFrame(0x8, new Uint8Array([0x03, 0xe8]));
    this.writeChain.finally(() => setTimeout(() => this.finish(), 200));
  }

  private finish() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    try { this.conn?.close(); } catch { /* already closed */ }
    try { this.onclose?.({}); } catch { /* ignore */ }
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}
function indexOfCrlfCrlf(b: Uint8Array): number {
  for (let i = 0; i + 3 < b.length; i++) if (b[i] === 13 && b[i + 1] === 10 && b[i + 2] === 13 && b[i + 3] === 10) return i;
  return -1;
}

async function connectSocket(maxAttempts = 6): Promise<WsLike> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { token, cookie } = await negotiate();
      const wsUrl = `${CORE_WS_URL}?id=${encodeURIComponent(token)}`;
      let ws: WsLike;
      try {
        ws = await RawWebSocket.open(wsUrl, cookie);
      } catch (rawErr) {
        console.warn(`raw websocket attempt ${attempt} failed: ${rawErr instanceof Error ? rawErr.message : rawErr}`);
        // Fallback: platform WebSocket without cookies (works ~2 in 3 when the LB has few nodes).
        const native = new WebSocket(wsUrl);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('websocket open timeout')), 8000);
          native.onopen = () => { clearTimeout(timer); resolve(); };
          native.onerror = (e) => { clearTimeout(timer); reject(new Error((e as ErrorEvent).message || 'websocket error')); };
          native.onclose = () => { clearTimeout(timer); reject(new Error('websocket closed before open')); };
        });
        ws = native as unknown as WsLike;
      }
      if (attempt > 1) console.log(`SignalR Core websocket opened on attempt ${attempt}.`);
      return ws;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw new Error(`SignalR Core connect failed after ${maxAttempts} attempts: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
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
  }
}

/** Handle one SignalR Core record. Returns false when the server closed the hub. */
function handleRecord(rec: Json, state: RelayState, ws: WsLike): boolean {
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
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 6 }) + RECORD_SEP);
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

// Before lights out the stream can carry the previous session's status
// (e.g. qualifying's "Ends" / archive "Complete") alongside the race's
// SessionInfo. Never treat the race as finished until it has been running
// for MIN_RACE_MS past its scheduled start.
const MIN_RACE_MS = 45 * 60 * 1000;
function isSessionFinished(state: RelayState): boolean {
  const si = state.sessionInfo;
  const start = toUtcMs(si.StartDate, si.GmtOffset);
  if (start === null || Date.now() < start + MIN_RACE_MS) return false;
  return FINISHED_STATUSES.has(state.sessionStatus.Status || '') ||
    si.SessionStatus === 'Finished' ||
    si.SessionStatus === 'Finalised';
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
      // The app's P10 Battle row renders `gap`; Alex wants the interval to the
      // car ahead there, so `gap` carries the interval and the gap to the
      // leader moves to `gapToLeader`.
      gap: textValue(data.IntervalToPositionAhead) || textValue(data.IntervalToNext) || textValue(data.GapToLeader),
      gapToLeader: textValue(data.GapToLeader),
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
    ...appTrackStatus(state),
    meeting: state.sessionInfo.Meeting?.Name || 'Unknown',
    session: state.sessionInfo.Name || 'Race',
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

async function runRelay({ season, dry, seconds }: RunOptions): Promise<{ payload: Payload | null; writes: number; finished: boolean; sessionSeen: string; linesSeen: number }> {
  const state: RelayState = {
    timing: { Lines: {} },
    appData: { Lines: {} },
    sessionInfo: {},
    sessionStatus: {},
    trackStatus: { Status: '1', Message: 'Green' },
    driverList: {},
    dynamicNumberToId: {},
    dynamicAcronymToId: {},
  };

  await fetchOfficialDrivers(season, state.dynamicNumberToId, state.dynamicAcronymToId);
  const ws = await connectSocket();

  let handshakeDone = false;
  let closed = false;
  let buffer = '';
  const closedPromise = new Promise<void>((resolve) => {
    ws.onclose = () => { closed = true; resolve(); };
  });

  ws.onerror = (e) => console.warn('WebSocket error:', e.message ?? e);
  ws.onmessage = async (event) => {
    const chunk = typeof event.data === 'string'
      ? event.data
      : new TextDecoder().decode(event.data instanceof Blob ? await event.data.arrayBuffer() : event.data as Uint8Array);
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

  ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEP);

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

  if (ws.readyState === 1 || ws.readyState === 0) ws.close();

  if (finished && !dry) await closeLiveWindow().catch((e) => console.warn('closeLiveWindow failed', e));

  if (!latest) {
    console.log(`No race data published. Session seen: ${state.sessionInfo.Type ?? '?'} / ${state.sessionInfo.Name ?? '?'}`);
  }
  return {
    payload: latest, writes, finished,
    sessionSeen: `${state.sessionInfo.Meeting?.Name ?? '?'} / ${state.sessionInfo.Name ?? '?'} (${state.sessionStatus.Status ?? '?'})`,
    linesSeen: Object.keys(state.timing.Lines || {}).length,
  };
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

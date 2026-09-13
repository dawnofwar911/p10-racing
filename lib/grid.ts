import { Driver } from '@/lib/types';
import { ApiResult, fetchQualifyingResults, fetchRaceResults } from '@/lib/api';
import type { SupabaseClient } from '@supabase/supabase-js';

export const OPENF1_BASE = 'https://api.openf1.org/v1';

export interface OpenF1StartingGridEntry {
  position: number;
  driver_number: number;
  lap_duration?: number | null;
  meeting_key?: number;
  session_key?: number;
}

export interface OpenF1Meeting {
  meeting_key: number;
  meeting_name: string;
  circuit_short_name: string;
  country_name: string;
  date_start: string;
  date_end: string;
  year: number;
}

export interface OpenF1Session {
  session_key: number;
  session_type: string;
  session_name: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
}

/**
 * Fetches the official starting grid from OpenF1 for the given season and race date.
 * Matches the race weekend meeting, finds the Grand Prix Qualifying session, and retrieves the grid.
 */
export async function fetchOpenF1StartingGrid(
  season: number,
  raceDate: string,
  timeoutMs = 4000
): Promise<OpenF1StartingGridEntry[] | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    // 1. Fetch meetings for the season
    const meetingsResp = await fetch(`${OPENF1_BASE}/meetings?year=${season}`, {
      signal: controller.signal
    });
    if (!meetingsResp.ok) {
      clearTimeout(id);
      return null;
    }
    const meetings: OpenF1Meeting[] = await meetingsResp.json();
    if (!Array.isArray(meetings) || meetings.length === 0) {
      clearTimeout(id);
      return null;
    }

    // 2. Match meeting by race date (+/- 1 day margin for timezones)
    const targetDate = new Date(raceDate);
    const meeting = meetings.find(m => {
      const start = new Date(m.date_start);
      const end = new Date(m.date_end);
      return targetDate >= new Date(start.getTime() - 86400000) &&
             targetDate <= new Date(end.getTime() + 86400000);
    });

    if (!meeting) {
      clearTimeout(id);
      return null;
    }

    // 3. Find the Grand Prix Qualifying session
    const sessionsResp = await fetch(
      `${OPENF1_BASE}/sessions?meeting_key=${meeting.meeting_key}&session_name=Qualifying`,
      { signal: controller.signal }
    );
    if (!sessionsResp.ok) {
      clearTimeout(id);
      return null;
    }
    const sessions: OpenF1Session[] = await sessionsResp.json();
    if (!Array.isArray(sessions) || sessions.length === 0) {
      clearTimeout(id);
      return null;
    }
    const sessionKey = sessions[0].session_key;

    // 4. Fetch starting grid for that session
    const gridResp = await fetch(
      `${OPENF1_BASE}/starting_grid?session_key=${sessionKey}`,
      { signal: controller.signal }
    );
    clearTimeout(id);

    if (!gridResp.ok) return null;
    const grid: OpenF1StartingGridEntry[] = await gridResp.json();
    if (Array.isArray(grid) && grid.length > 0) {
      return grid;
    }
    return null;
  } catch {
    // Fail gracefully on timeout or network error
    return null;
  }
}

/**
 * Merges OpenF1 starting grid positions (with penalties applied) onto driver/qualifying data.
 */
export function mergeStartingGrid(
  qualiGrid: ApiResult[],
  openf1Grid: OpenF1StartingGridEntry[],
  allDrivers: Driver[]
): ApiResult[] {
  const qualiByCarNumber = new Map<string, ApiResult>();
  qualiGrid.forEach(q => {
    if (q.number) qualiByCarNumber.set(String(q.number), q);
    if (q.Driver?.permanentNumber) qualiByCarNumber.set(String(q.Driver.permanentNumber), q);
  });

  const driversByNumber = new Map<number, Driver>();
  const driversById = new Map<string, Driver>();
  allDrivers.forEach(d => {
    driversByNumber.set(d.number, d);
    driversById.set(d.id, d);
  });

  const usedDriverIds = new Set<string>();
  const results: ApiResult[] = [];

  const sortedOpenF1 = [...openf1Grid].sort((a, b) => a.position - b.position);

  sortedOpenF1.forEach(entry => {
    const carNumberStr = String(entry.driver_number);
    const q = qualiByCarNumber.get(carNumberStr);
    const driverInfo = driversByNumber.get(entry.driver_number) ||
      (q?.Driver?.driverId ? driversById.get(q.Driver.driverId) : undefined);

    const driverId = q?.Driver?.driverId || driverInfo?.id || `driver_${carNumberStr}`;
    const code = q?.Driver?.code || driverInfo?.code || carNumberStr;
    const name = driverInfo?.name || (q ? `${q.Driver.givenName} ${q.Driver.familyName}` : `Driver #${carNumberStr}`);
    const team = driverInfo?.team || q?.Constructor?.name || 'Unknown Team';
    const teamId = driverInfo?.teamId || q?.Constructor?.constructorId || 'unknown';

    usedDriverIds.add(driverId);

    const qualiPosStr = q?.position;
    const qualiPosNum = qualiPosStr ? parseInt(qualiPosStr, 10) : null;
    const penalty = qualiPosNum !== null ? entry.position - qualiPosNum : 0;

    results.push({
      position: entry.position.toString(),
      number: carNumberStr,
      grid: entry.position.toString(),
      points: '0',
      status: 'Active',
      laps: '0',
      qualifyingPosition: qualiPosStr,
      penalty,
      Constructor: {
        constructorId: teamId,
        name: team
      },
      Driver: {
        driverId,
        code,
        permanentNumber: carNumberStr,
        givenName: name.split(' ')[0] || '',
        familyName: name.split(' ').slice(1).join(' ') || ''
      }
    });
  });

  // Append missing drivers
  const missing = allDrivers.filter(d => !usedDriverIds.has(d.id));
  missing.forEach((d) => {
    const nextPos = (results.length + 1).toString();
    results.push({
      position: nextPos,
      number: d.number.toString(),
      grid: nextPos,
      points: '0',
      status: 'DNS',
      laps: '0',
      Constructor: { constructorId: d.teamId, name: d.team },
      Driver: {
        driverId: d.id,
        code: d.code,
        permanentNumber: d.number.toString(),
        givenName: d.name.split(' ')[0] || '',
        familyName: d.name.split(' ').slice(1).join(' ') || ''
      }
    });
  });

  return results;
}

/**
 * Re-sorts completed race results by their starting grid (`r.grid`) instead of finish position.
 */
export function getStartingGridFromRaceResults(
  raceResults: ApiResult[],
  allDrivers: Driver[] = []
): ApiResult[] {
  const gridStarters: ApiResult[] = [];
  const pitOrDnsStarters: ApiResult[] = [];

  raceResults.forEach(r => {
    const gridNum = r.grid ? parseInt(r.grid, 10) : 0;
    if (gridNum > 0) {
      gridStarters.push({
        ...r,
        position: gridNum.toString(),
        grid: gridNum.toString()
      });
    } else {
      pitOrDnsStarters.push(r);
    }
  });

  gridStarters.sort((a, b) => parseInt(a.position, 10) - parseInt(b.position, 10));

  const finalGrid: ApiResult[] = [...gridStarters];
  pitOrDnsStarters.forEach(r => {
    const nextPos = (finalGrid.length + 1).toString();
    finalGrid.push({
      ...r,
      position: nextPos,
      grid: nextPos
    });
  });

  if (allDrivers.length > 0) {
    const presentIds = new Set(finalGrid.map(g => g.Driver.driverId));
    const missing = allDrivers.filter(d => !presentIds.has(d.id));
    missing.forEach(d => {
      const nextPos = (finalGrid.length + 1).toString();
      finalGrid.push({
        position: nextPos,
        number: d.number.toString(),
        grid: nextPos,
        points: '0',
        status: 'DNS',
        laps: '0',
        Constructor: { constructorId: d.teamId, name: d.team },
        Driver: {
          driverId: d.id,
          code: d.code,
          permanentNumber: d.number.toString(),
          givenName: d.name.split(' ')[0],
          familyName: d.name.split(' ').slice(1).join(' ')
        }
      });
    });
  }

  return finalGrid;
}

/**
 * Standard fallback to merge raw Jolpica qualifying classification with all drivers.
 */
export function mergeQualiFallback(
  qualiGrid: ApiResult[],
  allDrivers: Driver[]
): ApiResult[] {
  const presentIds = new Set(qualiGrid.map(q => q.Driver.driverId));
  const missing = allDrivers.filter(d => !presentIds.has(d.id));
  const finalGrid = [...qualiGrid];
  missing.forEach((d, i) => {
    const nextPos = (qualiGrid.length + i + 1).toString();
    finalGrid.push({
      position: nextPos,
      number: d.number.toString(),
      grid: nextPos,
      points: '0',
      status: 'DNS',
      laps: '0',
      Constructor: { constructorId: d.teamId, name: d.team },
      Driver: {
        driverId: d.id,
        code: d.code,
        permanentNumber: d.number.toString(),
        givenName: d.name.split(' ')[0],
        familyName: d.name.split(' ').slice(1).join(' ')
      }
    });
  });
  return finalGrid;
}

export interface FetchStartingGridOptions {
  season: number;
  round: number;
  raceDate?: string;
  allDrivers?: Driver[];
  supabase?: Pick<SupabaseClient, 'from'> | SupabaseClient;
}

/**
 * 4-Tier Starting Grid Resolution:
 * 1. Supabase kv_cache (Admin Overrides or Edge-Ingested grid)
 * 2. Official Race Results (if post-race, properly sorted by starting grid)
 * 3. OpenF1 Starting Grid API (with penalties applied)
 * 4. Jolpica Qualifying Results (raw classification fallback)
 */
export async function fetchStartingGrid(options: FetchStartingGridOptions): Promise<ApiResult[]> {
  const { season, round, raceDate, allDrivers = [], supabase } = options;

  // 1. Check Supabase kv_cache
  if (supabase) {
    try {
      const { data: cached } = await supabase
        .from('kv_cache')
        .select('value')
        .eq('key', `starting_grid_${season}_${round}`)
        .maybeSingle();

      if (cached?.value && Array.isArray(cached.value) && cached.value.length > 0) {
        return cached.value as ApiResult[];
      }
    } catch (e) {
      console.warn('Grid: kv_cache read error:', e);
    }
  }

  // 2. Check if Race Results already exist
  try {
    const raceResultsData = await fetchRaceResults(season, round);
    if (raceResultsData?.Results && raceResultsData.Results.length > 0) {
      return getStartingGridFromRaceResults(raceResultsData.Results, allDrivers);
    }
  } catch (e) {
    console.warn('Grid: fetchRaceResults error:', e);
  }

  // 3. Fetch Qualifying results from Jolpica
  const qualiGrid = await fetchQualifyingResults(season, round);
  if (!qualiGrid || qualiGrid.length === 0) {
    return [];
  }

  // 4. Try OpenF1 Starting Grid (with penalties applied)
  if (raceDate) {
    try {
      const openf1Grid = await fetchOpenF1StartingGrid(season, raceDate);
      if (openf1Grid && openf1Grid.length >= 15) {
        return mergeStartingGrid(qualiGrid, openf1Grid, allDrivers);
      }
    } catch (e) {
      console.warn('Grid: OpenF1 starting grid error:', e);
    }
  }

  // 5. Fallback to raw qualifying grid
  return mergeQualiFallback(qualiGrid, allDrivers);
}

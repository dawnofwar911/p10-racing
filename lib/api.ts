import { Driver, ConstructorStanding, TEAM_COLORS } from '@/lib/types';
import { isTrueDnf } from './utils/drivers';

export interface ApiDriver {
  driverId: string;
  permanentNumber: string;
  code: string;
  givenName: string;
  familyName: string;
}

export interface ApiResult {
  number: string;
  position: string;
  grid: string | null;
  points: string;
  Driver: ApiDriver;
  Constructor: {
    constructorId: string;
    name: string;
  };
  status: string;
  laps: string;
}

export interface ApiRace {
  season: string;
  round: string;
  raceName: string;
  Circuit: {
    circuitName: string;
  };
  date: string;
  time?: string;
  Results: ApiResult[];
}

export interface ApiCalendarRace {
  season: string;
  round: string;
  raceName: string;
  Circuit: {
    circuitName: string;
  };
  date: string;
  time?: string;
}

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

export async function fetchRaceResults(season: number, round: number): Promise<ApiRace | null> {
  try {
    const response = await fetch(`${BASE_URL}/${season}/${round}/results.json`);
    if (!response.ok) return null;
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) return null;

    const data = await response.json();
    const race = data?.MRData?.RaceTable?.Races?.[0];
    
    if (!race) return null;
    return race;
  } catch (error) {
    console.error('Error fetching race results:', error);
    return null;
  }
}

export async function fetchCalendar(season: number): Promise<ApiCalendarRace[]> {
  try {
    const response = await fetch(`${BASE_URL}/${season}.json`);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data?.MRData?.RaceTable?.Races || [];
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return [];
  }
}

/**
 * Formats driver names to fit better on mobile screens by shortening long names
 * like "Andrea Kimi Antonelli" to "Kimi Antonelli".
 */
function shortenDriverName(givenName: string, familyName: string): string {
  if (givenName === "Andrea Kimi" && familyName === "Antonelli") {
    return "Kimi Antonelli";
  }
  return `${givenName} ${familyName}`;
}

export async function fetchDrivers(season: number): Promise<Driver[]> {
  try {
    const response = await fetch(`${BASE_URL}/${season}/driverStandings.json`);
    const apiDrivers: Driver[] = [];
    if (response.ok) {
      const data = await response.json();
      const standings = data?.MRData?.StandingsTable?.StandingsLists?.[0];
      if (standings?.DriverStandings?.length > 0) {
        interface ApiStanding {
          points: string;
          Driver: ApiDriver;
          Constructors: { constructorId: string; name: string }[];
        }
        standings.DriverStandings.forEach((s: ApiStanding) => {
          apiDrivers.push({
            id: s.Driver.driverId,
            name: shortenDriverName(s.Driver.givenName, s.Driver.familyName),
            team: s.Constructors[0].name,
            teamId: s.Constructors[0].constructorId,
            code: s.Driver.code,
            number: s.Driver.permanentNumber ? parseInt(s.Driver.permanentNumber) : 0,
            color: TEAM_COLORS[s.Constructors[0].constructorId] || '#B6BABD',
            points: parseFloat(s.points) || 0
          });
        });
      }
    }

    const r1Response = await fetch(`${BASE_URL}/${season}/1/results.json`);
    if (r1Response.ok) {
      const r1Data = await r1Response.json();
      const race = r1Data?.MRData?.RaceTable?.Races?.[0];
      if (race && race.Results) {
        race.Results.forEach((r: ApiResult) => {
          const existing = apiDrivers.find(d => d.id === r.Driver.driverId);
          if (existing) {
            existing.number = parseInt(r.number);
          } else {
            apiDrivers.push({
              id: r.Driver.driverId,
              name: shortenDriverName(r.Driver.givenName, r.Driver.familyName),
              team: r.Constructor.name,
              teamId: r.Constructor.constructorId,
              code: r.Driver.code,
              number: parseInt(r.number),
              color: TEAM_COLORS[r.Constructor.constructorId] || '#B6BABD',
              points: 0 // If not in standings yet
            });
          }
        });
      }
    }

    return apiDrivers;
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
}

export async function fetchConstructors(season: number): Promise<ConstructorStanding[]> {
  try {
    const response = await fetch(`${BASE_URL}/${season}/constructorStandings.json`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const standings = data?.MRData?.StandingsTable?.StandingsLists?.[0];
    if (!standings?.ConstructorStandings) return [];

    interface ApiConstructorStanding {
      Constructor: {
        constructorId: string;
        name: string;
      };
      points: string;
    }

    return standings.ConstructorStandings.map((s: ApiConstructorStanding) => ({
      id: s.Constructor.constructorId,
      name: s.Constructor.name,
      points: parseFloat(s.points) || 0,
      color: TEAM_COLORS[s.Constructor.constructorId] || '#B6BABD'
    }));
  } catch (error) {
    console.error('Error fetching constructor standings:', error);
    return [];
  }
}

export async function fetchDriversFromOpenF1(sessionKey: number): Promise<Driver[]> {
  const ACRONYM_TO_ID: { [key: string]: string } = {
    'ALB': 'albon', 'ALO': 'alonso', 'ANT': 'antonelli', 'BEA': 'bearman',
    'BOR': 'bortoleto', 'BOT': 'bottas', 'COL': 'colapinto', 'GAS': 'gasly',
    'HAD': 'hadjar', 'HAM': 'hamilton', 'HUL': 'hulkenberg', 'LAW': 'lawson',
    'LEC': 'leclerc', 'LIN': 'arvid_lindblad', 'NOR': 'norris', 'OCO': 'ocon',
    'PIA': 'piastri', 'PER': 'perez', 'RUS': 'russell', 'SAI': 'sainz',
    'STR': 'stroll', 'VER': 'max_verstappen'
  };

  try {
    const response = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    interface OpenF1Driver {
      name_acronym: string;
      full_name: string;
      team_name: string;
      driver_number: number;
      team_colour: string;
    }
    return data.map((d: OpenF1Driver) => ({
      id: ACRONYM_TO_ID[d.name_acronym] || d.name_acronym.toLowerCase(),
      name: d.full_name,
      team: d.team_name,
      teamId: d.team_name.toLowerCase().replace(/\s+/g, '_'),
      code: d.name_acronym,
      number: d.driver_number,
      color: d.team_colour ? `#${d.team_colour}` : (TEAM_COLORS[d.team_name.toLowerCase().replace(/\s+/g, '_')] || '#B6BABD'),
      points: 0
    }));
  } catch (error) {
    console.error('Error fetching OpenF1 drivers:', error);
    return [];
  }
}

export async function fetchQualifyingResults(season: number, round: number): Promise<ApiResult[]> {
  try {
    const response = await fetch(`${BASE_URL}/${season}/${round}/qualifying.json`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const race = data?.MRData?.RaceTable?.Races?.[0];
    if (race && race.QualifyingResults) {
      return race.QualifyingResults;
    }
    return [];
  } catch (error) {
    console.error('Error fetching qualifying results:', error);
    return [];
  }
}

export type DriverFormMap = Record<string, { pos: number, status: string }[]>;

/**
 * Shared utility to determine if a status string indicates a DNF (Retired during race).
 * Excludes DNS (Did not start) and other non-participation statuses.
 * @deprecated Use isTrueDnf from @/lib/utils/drivers
 */
export function isDnfStatus(status: unknown, laps: string = "1"): boolean {
  return isTrueDnf(status, laps);
}

/**
 * Fetches the last N race results for all drivers in the given season.
 */
export async function fetchRecentResults(season: number, count: number = 3): Promise<DriverFormMap> {
  try {
    const response = await fetch(`${BASE_URL}/${season}/results.json?limit=500`);
    if (!response.ok) return {};

    const data = await response.json();
    const races = (data?.MRData?.RaceTable?.Races || [])
      .sort((a: ApiRace, b: ApiRace) => parseInt(a.round, 10) - parseInt(b.round, 10));
    
    // Take the latest 'count' races
    const latestRaces = races.slice(-count);
    const formMap: DriverFormMap = {};

    latestRaces.forEach((race: ApiRace) => {
      race.Results.forEach((result: ApiResult) => {
        const driverId = result.Driver.driverId;
        if (!formMap[driverId]) formMap[driverId] = [];
        
        formMap[driverId].push({
          pos: parseInt(result.position, 10) || 20, // Fallback to 20 for non-numeric (R, D, etc)
          status: result.status
        });
      });
    });

    return formMap;
  } catch (error) {
    console.error('Error fetching recent results:', error);
    return {};
  }
}

export function getP10DriverId(race: ApiRace): string | null {
  const p10Result = race.Results.find(r => r.position === "10");
  return p10Result ? p10Result.Driver.driverId : null;
}

export function getFirstDnfDriver(race: ApiRace): ApiDriver | null {
  const retirements = race.Results.filter(r => isDnfStatus(r.status, r.laps));

  if (retirements.length === 0) return null;

  retirements.sort((a, b) => {
    const lapsA = parseInt(a.laps);
    const lapsB = parseInt(b.laps);
    if (lapsA !== lapsB) return lapsA - lapsB;
    // Tie-breaker: higher position (numeric string) usually means earlier DNF/lower rank in Ergast
    return parseInt(b.position) - parseInt(a.position);
  });
  
  return retirements[0].Driver;
}

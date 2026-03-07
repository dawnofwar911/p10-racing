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
  Results: ApiResult[];
}

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

export async function fetchRaceResults(season: number, round: number): Promise<ApiRace | null> {
  try {
    const response = await fetch(`${BASE_URL}/${season}/${round}/results.json`);
    if (!response.ok) return null;
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) return null;

    const data = await response.json();
    const race = data.MRData.RaceTable.Races[0];
    
    if (!race) return null;
    return race;
  } catch (error) {
    console.error('Error fetching race results:', error);
    return null;
  }
}

export async function fetchCalendar(season: number): Promise<any[]> {
  try {
    const response = await fetch(`${BASE_URL}/${season}.json`);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.MRData.RaceTable.Races || [];
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return [];
  }
}

export const TEAM_COLORS: { [id: string]: string } = {
  red_bull: '#3671C6',
  ferrari: '#E80020',
  mclaren: '#FF8000',
  mercedes: '#27F4D2',
  aston_martin: '#229971',
  alpine: '#0093CC',
  williams: '#64C4FF',
  rb: '#6692FF',
  audi: '#ffffff',
  haas: '#B6BABD',
  cadillac: '#FFD700'
};

export async function fetchDrivers(season: number): Promise<any[]> {
  try {
    // 1. Try to get pairings from the latest available results or standings
    const response = await fetch(`${BASE_URL}/${season}/driverStandings.json`);
    if (response.ok) {
      const data = await response.json();
      const standings = data.MRData.StandingsTable.StandingsLists[0];
      if (standings && standings.DriverStandings.length > 0) {
        return standings.DriverStandings.map((s: any) => ({
          id: s.Driver.driverId,
          name: `${s.Driver.givenName} ${s.Driver.familyName}`,
          team: s.Constructors[0].name,
          teamId: s.Constructors[0].constructorId,
          code: s.Driver.code,
          number: parseInt(s.Driver.permanentNumber),
          color: TEAM_COLORS[s.Constructors[0].constructorId] || '#B6BABD'
        }));
      }
    }

    // 2. Try Round 1 results specifically
    const r1Response = await fetch(`${BASE_URL}/${season}/1/results.json`);
    if (r1Response.ok) {
      const r1Data = await r1Response.json();
      const race = r1Data.MRData.RaceTable.Races[0];
      if (race && race.Results) {
        return race.Results.map((r: any) => ({
          id: r.Driver.driverId,
          name: `${r.Driver.givenName} ${r.Driver.familyName}`,
          team: r.Constructor.name,
          teamId: r.Constructor.constructorId,
          code: r.Driver.code,
          number: parseInt(r.Driver.permanentNumber),
          color: TEAM_COLORS[r.Constructor.constructorId] || '#B6BABD'
        }));
      }
    }

    // 3. Last resort: Return empty so the component can use hardcoded FALLBACK_DRIVERS
    return [];
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
}

export async function fetchDriversFromOpenF1(sessionKey: number): Promise<any[]> {
  try {
    const response = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.map((d: any) => ({
      id: d.driver_number.toString(), // OpenF1 uses number as unique ID in sessions
      name: d.full_name,
      team: d.team_name,
      teamId: d.team_name.toLowerCase().replace(/\s+/g, '_'),
      code: d.name_acronym,
      number: d.driver_number,
      color: `#${d.team_colour}` || TEAM_COLORS[d.team_name.toLowerCase().replace(/\s+/g, '_')] || '#B6BABD'
    }));
  } catch (error) {
    console.error('Error fetching OpenF1 drivers:', error);
    return [];
  }
}

export async function fetchQualifyingResults(season: number, round: number): Promise<any[]> {
  try {
    const response = await fetch(`${BASE_URL}/${season}/${round}/qualifying.json`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const race = data.MRData.RaceTable.Races[0];
    if (race && race.QualifyingResults) {
      return race.QualifyingResults;
    }
    return [];
  } catch (error) {
    console.error('Error fetching qualifying results:', error);
    return [];
  }
}

export function getP10DriverId(race: ApiRace): string | null {
  const p10Result = race.Results.find(r => r.position === "10");
  return p10Result ? p10Result.Driver.driverId : null;
}

export function getFirstDnfDriverId(race: ApiRace): string | null {
  // Filter for results where status indicates a retirement.
  // "Finished" and statuses indicating being laps down (e.g. "+1 Lap", "Lapped") 
  // are usually considered classified finishers, not DNFs.
  const retirements = race.Results.filter(r => {
    const s = r.status;
    const isFinished = s === "Finished";
    const isLapped = s.toLowerCase().includes("lap"); 
    
    // In Ergast/Jolpica, DNFs have statuses like "Accident", "Engine", "Power Unit", "Collision", etc.
    return !isFinished && !isLapped;
  });

  if (retirements.length === 0) return null;

  // The first DNF is the one who completed the fewest laps.
  // Note: This is a simplification; in a real crash on Lap 1, multiple might have 0 laps.
  retirements.sort((a, b) => parseInt(a.laps) - parseInt(b.laps));
  
  return retirements[0].Driver.driverId;
}

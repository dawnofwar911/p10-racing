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
  grid: string;
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
    let apiDrivers: any[] = [];
    if (response.ok) {
      const data = await response.json();
      const standings = data.MRData.StandingsTable.StandingsLists[0];
      if (standings && standings.DriverStandings.length > 0) {
        apiDrivers = standings.DriverStandings.map((s: any) => ({
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

    // 2. Try Round 1 results to get the actual numbers being used this season (e.g. #1 for champ)
    const r1Response = await fetch(`${BASE_URL}/${season}/1/results.json`);
    if (r1Response.ok) {
      const r1Data = await r1Response.json();
      const race = r1Data.MRData.RaceTable.Races[0];
      if (race && race.Results) {
        race.Results.forEach((r: any) => {
          const existing = apiDrivers.find(d => d.id === r.Driver.driverId);
          if (existing) {
            existing.number = parseInt(r.number);
          } else {
            apiDrivers.push({
              id: r.Driver.driverId,
              name: `${r.Driver.givenName} ${r.Driver.familyName}`,
              team: r.Constructor.name,
              teamId: r.Constructor.constructorId,
              code: r.Driver.code,
              number: parseInt(r.number),
              color: TEAM_COLORS[r.Constructor.constructorId] || '#B6BABD'
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

export async function fetchDriversFromOpenF1(sessionKey: number): Promise<any[]> {
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
    return data.map((d: any) => ({
      id: ACRONYM_TO_ID[d.name_acronym] || d.name_acronym.toLowerCase(),
      name: d.full_name,
      team: d.team_name,
      teamId: d.team_name.toLowerCase().replace(/\s+/g, '_'),
      code: d.name_acronym,
      number: d.driver_number,
      color: d.team_colour ? `#${d.team_colour}` : (TEAM_COLORS[d.team_name.toLowerCase().replace(/\s+/g, '_')] || '#B6BABD')
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

export function getFirstDnfDriver(race: ApiRace): ApiDriver | null {
  // Filter for results where status indicates a retirement.
  // We want to exclude "Finished", lapped finishers, and "Did not start" (DNS).
  const retirements = race.Results.filter(r => {
    const s = r.status.toLowerCase();
    const isFinished = s === "finished";
    const isLapped = s.includes("lap"); 
    const isDns = s.includes("not start") || s === "dns";
    
    return !isFinished && !isLapped && !isDns;
  });

  if (retirements.length === 0) return null;

  // The first DNF is the one who completed the fewest laps.
  retirements.sort((a, b) => parseInt(a.laps) - parseInt(b.laps));
  
  return retirements[0].Driver;
}

export interface Driver {
  id: string;
  name: string;
  team: string;
  teamId: string;
  code: string;
  number: number;
  color: string;
  points: number;
}

export const DRIVERS: Driver[] = [
  // Red Bull Racing
  { id: 'max_verstappen', name: 'Max Verstappen', team: 'Red Bull Racing', teamId: 'red_bull', code: 'VER', number: 3, color: '#3671C6', points: 0 },
  { id: 'hadjar', name: 'Isack Hadjar', team: 'Red Bull Racing', teamId: 'red_bull', code: 'HAD', number: 6, color: '#3671C6', points: 0 },
  
  // Ferrari
  { id: 'hamilton', name: 'Lewis Hamilton', team: 'Ferrari', teamId: 'ferrari', code: 'HAM', number: 44, color: '#E80020', points: 0 },
  { id: 'leclerc', name: 'Charles Leclerc', team: 'Ferrari', teamId: 'ferrari', code: 'LEC', number: 16, color: '#E80020', points: 0 },
  
  // McLaren
  { id: 'norris', name: 'Lando Norris', team: 'McLaren', teamId: 'mclaren', code: 'NOR', number: 1, color: '#FF8000', points: 0 },
  { id: 'piastri', name: 'Oscar Piastri', team: 'McLaren', teamId: 'mclaren', code: 'PIA', number: 81, color: '#FF8000', points: 0 },
  
  // Mercedes
  { id: 'russell', name: 'George Russell', team: 'Mercedes', teamId: 'mercedes', code: 'RUS', number: 63, color: '#27F4D2', points: 0 },
  { id: 'antonelli', name: 'Kimi Antonelli', team: 'Mercedes', teamId: 'mercedes', code: 'ANT', number: 12, color: '#27F4D2', points: 0 },
  
  // Aston Martin
  { id: 'alonso', name: 'Fernando Alonso', team: 'Aston Martin', teamId: 'aston_martin', code: 'ALO', number: 14, color: '#229971', points: 0 },
  { id: 'stroll', name: 'Lance Stroll', team: 'Aston Martin', teamId: 'aston_martin', code: 'STR', number: 18, color: '#229971', points: 0 },
  
  // Alpine
  { id: 'gasly', name: 'Pierre Gasly', team: 'Alpine', teamId: 'alpine', code: 'GAS', number: 10, color: '#0093CC', points: 0 },
  { id: 'colapinto', name: 'Franco Colapinto', team: 'Alpine', teamId: 'alpine', code: 'COL', number: 43, color: '#0093CC', points: 0 },
  
  // Williams
  { id: 'albon', name: 'Alex Albon', team: 'Williams', teamId: 'williams', code: 'ALB', number: 23, color: '#64C4FF', points: 0 },
  { id: 'sainz', name: 'Carlos Sainz', team: 'Williams', teamId: 'williams', code: 'SAI', number: 55, color: '#64C4FF', points: 0 },
  
  // RB (Visa Cash App RB)
  { id: 'lawson', name: 'Liam Lawson', team: 'RB', teamId: 'rb', code: 'LAW', number: 30, color: '#6692FF', points: 0 },
  { id: 'arvid_lindblad', name: 'Arvid Lindblad', team: 'RB', teamId: 'rb', code: 'LIN', number: 41, color: '#6692FF', points: 0 },
  
  // Audi
  { id: 'hulkenberg', name: 'Nico Hulkenberg', team: 'Audi', teamId: 'audi', code: 'HUL', number: 27, color: '#ffffff', points: 0 },
  { id: 'bortoleto', name: 'Gabriel Bortoleto', team: 'Audi', teamId: 'audi', code: 'BOR', number: 5, color: '#ffffff', points: 0 },
  
  // Haas
  { id: 'ocon', name: 'Esteban Ocon', team: 'Haas', teamId: 'haas', code: 'OCO', number: 31, color: '#B6BABD', points: 0 },
  { id: 'bearman', name: 'Oliver Bearman', team: 'Haas', teamId: 'haas', code: 'BEA', number: 87, color: '#B6BABD', points: 0 },

  // Cadillac
  { id: 'perez', name: 'Sergio Perez', team: 'Cadillac', teamId: 'cadillac', code: 'PER', number: 11, color: '#FFD700', points: 0 },
  { id: 'bottas', name: 'Valtteri Bottas', team: 'Cadillac', teamId: 'cadillac', code: 'BOT', number: 77, color: '#FFD700', points: 0 },
];

export interface Race {
  id: string;
  name: string;
  circuit: string;
  date: string;
  time?: string;
  round: number;
}

export const RACES: Race[] = [
  { id: '1', name: 'Australian Grand Prix', circuit: 'Albert Park Circuit', date: '2026-03-15', round: 1 },
];

export interface LeaderboardEntry {
  rank: number;
  player: string;
  points: number;
  lastRacePoints: number;
  breakdown?: {
    p10Points: number;
    dnfPoints: number;
    p10Driver: string;
    actualP10Pos: number;
  };
  history?: { 
    round: string, 
    points: number, 
    totalSoFar: number, 
    p10Driver: string, 
    dnfDriver: string, 
    p10Pos: number, 
    dnfCorrect: boolean 
  }[];
}

export interface SimplifiedResults {
  positions: { [driverId: string]: number };
  firstDnf: string | null;
}

export interface UserPrediction {
  username: string;
  p10: string;
  dnf: string;
  raceId: string;
}

export const getSystemSeason = () => new Date().getFullYear();

export const isPreseason = (date?: Date) => {
  const now = date || new Date();
  const month = now.getMonth(); // 0-indexed, Jan=0, Feb=1, Mar=2
  // Preseason is Jan and Feb. Season starts in March.
  return month < 2;
};

export const CURRENT_SEASON = isPreseason() ? getSystemSeason() - 1 : getSystemSeason();
export const NEXT_SEASON = CURRENT_SEASON + 1;
export const DISPLAY_SEASON = CURRENT_SEASON;

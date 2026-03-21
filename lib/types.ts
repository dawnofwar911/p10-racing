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

export interface ConstructorStanding {
  id: string;
  name: string;
  points: number;
  color: string;
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
  vcarb: '#6692FF',
  racing_bulls: '#6692FF',
  alphatauri: '#6692FF',
  audi: '#ffffff',
  sauber: '#ffffff',
  kick_sauber: '#52E252',
  haas: '#B6BABD',
  haas_f1_team: '#B6BABD',
  cadillac: '#FFD700'
};

export interface Race {
  id: string;
  name: string;
  circuit: string;
  date: string;
  time?: string;
  round: number;
}

export interface SimplifiedResults {
  positions: { [driverId: string]: number };
  firstDnf: string | null;
}

export interface DbPrediction {
  id: string;
  user_id: string;
  race_id: string;
  p10_driver_id: string;
  dnf_driver_id: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string;
  };
}

export interface UserPrediction {
  username: string;
  p10: string;
  dnf: string;
  raceId: string;
}

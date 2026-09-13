import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import {
  fetchOpenF1StartingGrid,
  mergeStartingGrid,
  getStartingGridFromRaceResults,
  mergeQualiFallback,
  fetchStartingGrid,
  getMaxGridSize,
  getEligibleMissingDrivers,
  OPENF1_BASE
} from '@/lib/grid';
import { Driver } from '@/lib/types';
import { ApiResult } from '@/lib/api';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

const mockDrivers: Driver[] = [
  { id: 'leclerc', name: 'Charles Leclerc', team: 'Ferrari', teamId: 'ferrari', code: 'LEC', number: 16, color: '#E80020', points: 0 },
  { id: 'perez', name: 'Sergio Perez', team: 'Red Bull', teamId: 'red_bull', code: 'PER', number: 11, color: '#3671C6', points: 0 },
  { id: 'hamilton', name: 'Lewis Hamilton', team: 'Mercedes', teamId: 'mercedes', code: 'HAM', number: 44, color: '#27F4D2', points: 0 },
  { id: 'norris', name: 'Lando Norris', team: 'McLaren', teamId: 'mclaren', code: 'NOR', number: 4, color: '#FF8000', points: 0 },
  { id: 'piastri', name: 'Oscar Piastri', team: 'McLaren', teamId: 'mclaren', code: 'PIA', number: 81, color: '#FF8000', points: 0 },
  { id: 'russell', name: 'George Russell', team: 'Mercedes', teamId: 'mercedes', code: 'RUS', number: 63, color: '#27F4D2', points: 0 },
  { id: 'sainz', name: 'Carlos Sainz', team: 'Ferrari', teamId: 'ferrari', code: 'SAI', number: 55, color: '#E80020', points: 0 },
  { id: 'alonso', name: 'Fernando Alonso', team: 'Aston Martin', teamId: 'aston_martin', code: 'ALO', number: 14, color: '#229971', points: 0 },
  { id: 'ocon', name: 'Esteban Ocon', team: 'Alpine', teamId: 'alpine', code: 'OCO', number: 31, color: '#0093CC', points: 0 },
  { id: 'albon', name: 'Alex Albon', team: 'Williams', teamId: 'williams', code: 'ALB', number: 23, color: '#64C4FF', points: 0 },
  { id: 'max_verstappen', name: 'Max Verstappen', team: 'Red Bull', teamId: 'red_bull', code: 'VER', number: 1, color: '#3671C6', points: 0 },
];

describe('Starting Grid & Penalty Logic', () => {
  describe('mergeStartingGrid with Grid Penalties', () => {
    // 2024 Spa Belgian GP scenario:
    // Verstappen qualifies P1 (number 1), but takes 10-place penalty to start P11.
    // Leclerc qualifies P2, starts P1.
    // Albon qualifies P11, moves up to P10.
    const qualiResults: ApiResult[] = [
      { position: '1', number: '1', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'red_bull', name: 'Red Bull' }, Driver: { driverId: 'max_verstappen', code: 'VER', permanentNumber: '1', givenName: 'Max', familyName: 'Verstappen' } },
      { position: '2', number: '16', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'ferrari', name: 'Ferrari' }, Driver: { driverId: 'leclerc', code: 'LEC', permanentNumber: '16', givenName: 'Charles', familyName: 'Leclerc' } },
      { position: '3', number: '11', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'red_bull', name: 'Red Bull' }, Driver: { driverId: 'perez', code: 'PER', permanentNumber: '11', givenName: 'Sergio', familyName: 'Perez' } },
      { position: '4', number: '44', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'mercedes', name: 'Mercedes' }, Driver: { driverId: 'hamilton', code: 'HAM', permanentNumber: '44', givenName: 'Lewis', familyName: 'Hamilton' } },
      { position: '5', number: '4', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'mclaren', name: 'McLaren' }, Driver: { driverId: 'norris', code: 'NOR', permanentNumber: '4', givenName: 'Lando', familyName: 'Norris' } },
      { position: '6', number: '81', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'mclaren', name: 'McLaren' }, Driver: { driverId: 'piastri', code: 'PIA', permanentNumber: '81', givenName: 'Oscar', familyName: 'Piastri' } },
      { position: '7', number: '63', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'mercedes', name: 'Mercedes' }, Driver: { driverId: 'russell', code: 'RUS', permanentNumber: '63', givenName: 'George', familyName: 'Russell' } },
      { position: '8', number: '55', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'ferrari', name: 'Ferrari' }, Driver: { driverId: 'sainz', code: 'SAI', permanentNumber: '55', givenName: 'Carlos', familyName: 'Sainz' } },
      { position: '9', number: '14', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'aston_martin', name: 'Aston Martin' }, Driver: { driverId: 'alonso', code: 'ALO', permanentNumber: '14', givenName: 'Fernando', familyName: 'Alonso' } },
      { position: '10', number: '31', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'alpine', name: 'Alpine' }, Driver: { driverId: 'ocon', code: 'OCO', permanentNumber: '31', givenName: 'Esteban', familyName: 'Ocon' } },
      { position: '11', number: '23', grid: null, points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'williams', name: 'Williams' }, Driver: { driverId: 'albon', code: 'ALB', permanentNumber: '23', givenName: 'Alex', familyName: 'Albon' } },
    ];

    const openf1StartingGrid = [
      { position: 1, driver_number: 16 },
      { position: 2, driver_number: 11 },
      { position: 3, driver_number: 44 },
      { position: 4, driver_number: 4 },
      { position: 5, driver_number: 81 },
      { position: 6, driver_number: 63 },
      { position: 7, driver_number: 55 },
      { position: 8, driver_number: 14 },
      { position: 9, driver_number: 31 },
      { position: 10, driver_number: 23 },
      { position: 11, driver_number: 1 },
    ];

    it('correctly reorders grid and sets penalty indicators when penalties exist', () => {
      const merged = mergeStartingGrid(qualiResults, openf1StartingGrid, mockDrivers);

      expect(merged).toHaveLength(11);

      // P1 should be Leclerc (who qualified P2)
      expect(merged[0].position).toBe('1');
      expect(merged[0].Driver.driverId).toBe('leclerc');
      expect(merged[0].qualifyingPosition).toBe('2');
      expect(merged[0].penalty).toBe(-1); // Gained 1 position

      // Target P10 should be Albon (who qualified P11)
      const p10 = merged.find(m => m.position === '10');
      expect(p10).toBeDefined();
      expect(p10?.Driver.driverId).toBe('albon');
      expect(p10?.qualifyingPosition).toBe('11');

      // P11 should be Verstappen with +10 penalty
      const ver = merged.find(m => m.Driver.driverId === 'max_verstappen');
      expect(ver).toBeDefined();
      expect(ver?.position).toBe('11');
      expect(ver?.qualifyingPosition).toBe('1');
      expect(ver?.penalty).toBe(10);
    });

    it('appends missing drivers at the end of the grid', () => {
      const partialGrid = openf1StartingGrid.slice(0, 10); // Verstappen omitted
      const merged = mergeStartingGrid(qualiResults, partialGrid, mockDrivers);

      expect(merged).toHaveLength(11);
      const lastDriver = merged[merged.length - 1];
      expect(lastDriver.Driver.driverId).toBe('max_verstappen');
      expect(lastDriver.position).toBe('11');
      expect(lastDriver.status).toBe('DNS');
    });
  });

  describe('getStartingGridFromRaceResults', () => {
    it('sorts race results by starting grid rather than race finish position', () => {
      // In race: Hamilton finished P1 after starting P3; Leclerc finished P3 after starting P1
      const raceResults: ApiResult[] = [
        { position: '1', grid: '3', number: '44', points: '25', status: 'Finished', laps: '44', Constructor: { constructorId: 'mercedes', name: 'Mercedes' }, Driver: { driverId: 'hamilton', code: 'HAM', permanentNumber: '44', givenName: 'Lewis', familyName: 'Hamilton' } },
        { position: '2', grid: '5', number: '81', points: '18', status: 'Finished', laps: '44', Constructor: { constructorId: 'mclaren', name: 'McLaren' }, Driver: { driverId: 'piastri', code: 'PIA', permanentNumber: '81', givenName: 'Oscar', familyName: 'Piastri' } },
        { position: '3', grid: '1', number: '16', points: '15', status: 'Finished', laps: '44', Constructor: { constructorId: 'ferrari', name: 'Ferrari' }, Driver: { driverId: 'leclerc', code: 'LEC', permanentNumber: '16', givenName: 'Charles', familyName: 'Leclerc' } },
        { position: '4', grid: '11', number: '1', points: '12', status: 'Finished', laps: '44', Constructor: { constructorId: 'red_bull', name: 'Red Bull' }, Driver: { driverId: 'max_verstappen', code: 'VER', permanentNumber: '1', givenName: 'Max', familyName: 'Verstappen' } },
      ];

      const startingGrid = getStartingGridFromRaceResults(raceResults);
      expect(startingGrid[0].position).toBe('1');
      expect(startingGrid[0].Driver.driverId).toBe('leclerc');

      expect(startingGrid[1].position).toBe('3');
      expect(startingGrid[1].Driver.driverId).toBe('hamilton');

      expect(startingGrid[2].position).toBe('5');
      expect(startingGrid[2].Driver.driverId).toBe('piastri');

      expect(startingGrid[3].position).toBe('11');
      expect(startingGrid[3].Driver.driverId).toBe('max_verstappen');
    });
  });

  describe('fetchOpenF1StartingGrid', () => {
    it('returns starting grid from OpenF1 on successful API responses', async () => {
      server.use(
        http.get(`${OPENF1_BASE}/meetings`, () => {
          return HttpResponse.json([
            {
              meeting_key: 1242,
              meeting_name: 'Belgian Grand Prix',
              date_start: '2024-07-26T11:30:00+00:00',
              date_end: '2024-07-28T15:00:00+00:00',
              year: 2024
            }
          ]);
        }),
        http.get(`${OPENF1_BASE}/sessions`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('session_name') === 'Qualifying') {
            return HttpResponse.json([
              { session_key: 9570, session_name: 'Qualifying', meeting_key: 1242 }
            ]);
          }
          return HttpResponse.json([]);
        }),
        http.get(`${OPENF1_BASE}/starting_grid`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('session_key') === '9570') {
            return HttpResponse.json([
              { position: 1, driver_number: 16 },
              { position: 2, driver_number: 11 },
              { position: 11, driver_number: 1 }
            ]);
          }
          return HttpResponse.json([]);
        })
      );

      const grid = await fetchOpenF1StartingGrid(2024, '2024-07-28');
      expect(grid).not.toBeNull();
      expect(grid).toHaveLength(3);
      expect(grid![0].position).toBe(1);
      expect(grid![0].driver_number).toBe(16);
      expect(grid![2].position).toBe(11);
      expect(grid![2].driver_number).toBe(1);
    });

    it('returns null if meeting is not found or OpenF1 returns an error', async () => {
      server.use(
        http.get(`${OPENF1_BASE}/meetings`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const grid = await fetchOpenF1StartingGrid(2024, '2024-07-28');
      expect(grid).toBeNull();
    });
  });

  describe('fetchStartingGrid Multi-Tier Resolution', () => {
    it('prioritizes Supabase kv_cache override when present', async () => {
      const mockCachedGrid: ApiResult[] = [
        { position: '1', number: '16', grid: '1', points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'ferrari', name: 'Ferrari' }, Driver: { driverId: 'leclerc', code: 'LEC', permanentNumber: '16', givenName: 'Charles', familyName: 'Leclerc' } }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { value: mockCachedGrid } })
            })
          })
        })
      };

      const grid = await fetchStartingGrid({
        season: 2026,
        round: 1,
        raceDate: '2026-03-15',
        supabase: mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient
      });

      expect(grid).toEqual(mockCachedGrid);
      expect(mockSupabase.from).toHaveBeenCalledWith('kv_cache');
    });

    it('falls back to raw Jolpica qualifying classification when OpenF1 is unavailable', async () => {
      server.use(
        http.get(`${JOLPICA_BASE}/2026/1/results.json`, () => {
          return HttpResponse.json({ MRData: { RaceTable: { Races: [] } } });
        }),
        http.get(`${JOLPICA_BASE}/2026/1/qualifying.json`, () => {
          return HttpResponse.json({
            MRData: {
              RaceTable: {
                Races: [{
                  QualifyingResults: [
                    { position: '1', number: '1', Driver: { driverId: 'norris', code: 'NOR' }, Constructor: { constructorId: 'mclaren', name: 'McLaren' } },
                    { position: '2', number: '81', Driver: { driverId: 'piastri', code: 'PIA' }, Constructor: { constructorId: 'mclaren', name: 'McLaren' } }
                  ]
                }]
              }
            }
          });
        }),
        http.get(`${OPENF1_BASE}/meetings`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const grid = await fetchStartingGrid({
        season: 2026,
        round: 1,
        raceDate: '2026-03-15',
        allDrivers: [
          { id: 'norris', code: 'NOR', number: 1, name: 'Lando Norris', team: 'McLaren', teamId: 'mclaren', color: '#FF8000', points: 0 },
          { id: 'piastri', code: 'PIA', number: 81, name: 'Oscar Piastri', team: 'McLaren', teamId: 'mclaren', color: '#FF8000', points: 0 }
        ]
      });

      expect(grid).toHaveLength(2);
      expect(grid[0].Driver.driverId).toBe('norris');
      expect(grid[0].position).toBe('1');
      expect(grid[1].Driver.driverId).toBe('piastri');
      expect(grid[1].position).toBe('2');
    });

    it('hydrates placeholder kv_cache entries with driver info from allDrivers', async () => {
      const mockCachedWithPlaceholder: ApiResult[] = [
        {
          position: '1', number: '1', grid: '1', points: '0', status: 'Active', laps: '0',
          Constructor: { constructorId: 'mclaren', name: 'McLaren' },
          Driver: { driverId: 'norris', code: 'NOR', permanentNumber: '1', givenName: 'Lando', familyName: 'Norris' }
        },
        {
          position: '21', number: '18', grid: '21', points: '0', status: 'Active', laps: '0',
          Constructor: { constructorId: 'unknown', name: 'Unknown' },
          Driver: { driverId: 'driver_18', code: '18', permanentNumber: '18', givenName: 'Driver', familyName: '#18' }
        }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { value: mockCachedWithPlaceholder } })
            })
          })
        })
      };

      const grid = await fetchStartingGrid({
        season: 2026,
        round: 14,
        allDrivers: [
          { id: 'norris', code: 'NOR', number: 1, name: 'Lando Norris', team: 'McLaren', teamId: 'mclaren', color: '#FF8000', points: 0 },
          { id: 'stroll', code: 'STR', number: 18, name: 'Lance Stroll', team: 'Aston Martin', teamId: 'aston_martin', color: '#229971', points: 0 }
        ],
        supabase: mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient
      });

      expect(grid).toHaveLength(2);
      expect(grid[1].Driver.driverId).toBe('stroll');
      expect(grid[1].Driver.code).toBe('STR');
      expect(grid[1].Constructor.name).toBe('Aston Martin');
    });
  });

  describe('Grid Capping & Constructor Limit Rules', () => {
    it('getMaxGridSize returns 22 for 2026+ and 20 for earlier seasons', () => {
      expect(getMaxGridSize(2026)).toBe(22);
      expect(getMaxGridSize(2027)).toBe(22);
      expect(getMaxGridSize(2025)).toBe(20);
      expect(getMaxGridSize(2024)).toBe(20);
    });

    it('getEligibleMissingDrivers enforces 2 cars per constructor limit and rejects 3rd driver', () => {
      const currentGrid: ApiResult[] = [
        { position: '1', number: '1', grid: '1', points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'red_bull', name: 'Red Bull' }, Driver: { driverId: 'max_verstappen', code: 'VER', permanentNumber: '1', givenName: 'Max', familyName: 'Verstappen' } },
        { position: '2', number: '30', grid: '2', points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'red_bull', name: 'Red Bull' }, Driver: { driverId: 'lawson', code: 'LAW', permanentNumber: '30', givenName: 'Liam', familyName: 'Lawson' } },
        { position: '3', number: '14', grid: '3', points: '0', status: 'Active', laps: '0', Constructor: { constructorId: 'aston_martin', name: 'Aston Martin' }, Driver: { driverId: 'alonso', code: 'ALO', permanentNumber: '14', givenName: 'Fernando', familyName: 'Alonso' } },
      ];

      const allDrivers: Driver[] = [
        // Red Bull already has 2 drivers in currentGrid -> hadjar MUST be rejected
        { id: 'hadjar', code: 'HAD', number: 6, name: 'Isack Hadjar', team: 'Red Bull', teamId: 'red_bull', color: '#3671C6', points: 0 },
        // Aston Martin has only 1 driver in currentGrid -> stroll MUST be accepted
        { id: 'stroll', code: 'STR', number: 18, name: 'Lance Stroll', team: 'Aston Martin', teamId: 'aston_martin', color: '#229971', points: 0 },
      ];

      const eligible = getEligibleMissingDrivers(currentGrid, allDrivers, 22);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].id).toBe('stroll');
    });

    it('mergeQualiFallback never exceeds season maxGridSize and does not include 23rd driver', () => {
      // 20 drivers qualify
      const quali20: ApiResult[] = Array.from({ length: 20 }, (_, i) => ({
        position: (i + 1).toString(),
        number: (i + 1).toString(),
        grid: (i + 1).toString(),
        points: '0',
        status: 'Active',
        laps: '0',
        Constructor: { constructorId: `team_${Math.floor(i / 2)}`, name: `Team ${Math.floor(i / 2)}` },
        Driver: { driverId: `d_${i + 1}`, code: `D${i + 1}`, permanentNumber: (i + 1).toString(), givenName: 'D', familyName: `${i + 1}` }
      }));

      // In quali20, teams 0-9 have 2 drivers each (20 total).
      // Suppose allDrivers has 23 drivers:
      // team 10 driver A (stroll) -> should be added (1st car for team 10)
      // team 10 driver B (bearman) -> should be added (2nd car for team 10)
      // team 0 driver C (hadjar reserve) -> should be rejected (team 0 already has 2 cars)
      const allDrivers23: Driver[] = [
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `d_${i + 1}`,
          code: `D${i + 1}`,
          number: i + 1,
          name: `D ${i + 1}`,
          team: `Team ${Math.floor(i / 2)}`,
          teamId: `team_${Math.floor(i / 2)}`,
          color: '#FFF',
          points: 0
        })),
        { id: 'stroll', code: 'STR', number: 21, name: 'Lance Stroll', team: 'Team 10', teamId: 'team_10', color: '#FFF', points: 0 },
        { id: 'bearman', code: 'BEA', number: 22, name: 'Oliver Bearman', team: 'Team 10', teamId: 'team_10', color: '#FFF', points: 0 },
        { id: 'hadjar', code: 'HAD', number: 23, name: 'Isack Hadjar', team: 'Team 0', teamId: 'team_0', color: '#FFF', points: 0 }
      ];

      const fallbackGrid = mergeQualiFallback(quali20, allDrivers23, 2026);
      expect(fallbackGrid).toHaveLength(22);
      expect(fallbackGrid.some(g => g.Driver.driverId === 'hadjar')).toBe(false);
      expect(fallbackGrid.some(g => g.Driver.driverId === 'stroll')).toBe(true);
      expect(fallbackGrid.some(g => g.Driver.driverId === 'bearman')).toBe(true);
    });

    it('mergeStartingGrid does not append extra drivers when OpenF1 starting grid is already complete', () => {
      // 22 drivers in OpenF1 starting grid
      const openf1FullGrid = Array.from({ length: 22 }, (_, i) => ({
        position: i + 1,
        driver_number: i + 1
      }));

      const quali20: ApiResult[] = Array.from({ length: 20 }, (_, i) => ({
        position: (i + 1).toString(),
        number: (i + 1).toString(),
        grid: (i + 1).toString(),
        points: '0',
        status: 'Active',
        laps: '0',
        Constructor: { constructorId: `team_${Math.floor(i / 2)}`, name: `Team ${Math.floor(i / 2)}` },
        Driver: { driverId: `d_${i + 1}`, code: `D${i + 1}`, permanentNumber: (i + 1).toString(), givenName: 'D', familyName: `${i + 1}` }
      }));

      const allDrivers23: Driver[] = [
        ...Array.from({ length: 22 }, (_, i) => ({
          id: `d_${i + 1}`,
          code: `D${i + 1}`,
          number: i + 1,
          name: `D ${i + 1}`,
          team: `Team ${Math.floor(i / 2)}`,
          teamId: `team_${Math.floor(i / 2)}`,
          color: '#FFF',
          points: 0
        })),
        // 23rd driver who is not on the grid
        { id: 'reserve_driver', code: 'RES', number: 99, name: 'Reserve Driver', team: 'Team 0', teamId: 'team_0', color: '#FFF', points: 0 }
      ];

      const merged = mergeStartingGrid(quali20, openf1FullGrid, allDrivers23, 2026);
      expect(merged).toHaveLength(22);
      expect(merged.some(g => g.Driver.driverId === 'reserve_driver')).toBe(false);
    });
  });
});

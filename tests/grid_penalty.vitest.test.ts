import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import {
  fetchOpenF1StartingGrid,
  mergeStartingGrid,
  getStartingGridFromRaceResults,
  mergeQualiFallback,
  fetchStartingGrid,
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
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import { 
  fetchRaceResults, 
  fetchCalendar, 
  fetchDrivers, 
  fetchDriversFromOpenF1,
  fetchQualifyingResults,
  getP10DriverId,
  getFirstDnfDriver,
  ApiRace
} from '@/lib/api';

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

describe('API Logic Tests', () => {
  describe('fetchRaceResults', () => {
    it('should return race results on success', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/1/results.json`, () => {
          return HttpResponse.json({
            MRData: {
              RaceTable: {
                Races: [{ raceName: 'Mock Race', Results: [] }]
              }
            }
          });
        })
      );

      const result = await fetchRaceResults(2026, 1);
      expect(result).not.toBeNull();
      expect(result?.raceName).toBe('Mock Race');
    });

    it('should return null on 404', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/99/results.json`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const result = await fetchRaceResults(2026, 99);
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/1/results.json`, () => {
          return HttpResponse.error();
        })
      );

      // Silence console.error for this expected failure
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await fetchRaceResults(2026, 1);
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('fetchCalendar', () => {
    it('should return a list of races', async () => {
      server.use(
        http.get(`${BASE_URL}/2026.json`, () => {
          return HttpResponse.json({
            MRData: {
              RaceTable: {
                Races: [{ round: '1', raceName: 'Race 1' }, { round: '2', raceName: 'Race 2' }]
              }
            }
          });
        })
      );

      const calendar = await fetchCalendar(2026);
      expect(calendar).toHaveLength(2);
      expect(calendar[0].raceName).toBe('Race 1');
    });
  });

  describe('fetchDrivers', () => {
    it('should merge standings and race 1 results', async () => {
      // Mock Standings
      server.use(
        http.get(`${BASE_URL}/2026/driverStandings.json`, () => {
          return HttpResponse.json({
            MRData: {
              StandingsTable: {
                StandingsLists: [{
                  DriverStandings: [
                    {
                      points: '25',
                      Driver: { driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen', code: 'VER', permanentNumber: '3' },
                      Constructors: [{ constructorId: 'red_bull', name: 'Red Bull' }]
                    }
                  ]
                }]
              }
            }
          });
        })
      );

      // Mock Race 1 Results
      server.use(
        http.get(`${BASE_URL}/2026/1/results.json`, () => {
          return HttpResponse.json({
            MRData: {
              RaceTable: {
                Races: [{
                  Results: [
                    {
                      number: '3',
                      Driver: { driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
                      Constructor: { constructorId: 'red_bull', name: 'Red Bull' }
                    },
                    {
                      number: '44',
                      Driver: { driverId: 'hamilton', givenName: 'Lewis', familyName: 'Hamilton', code: 'HAM' },
                      Constructor: { constructorId: 'ferrari', name: 'Ferrari' }
                    }
                  ]
                }]
              }
            }
          });
        })
      );

      const drivers = await fetchDrivers(2026);
      expect(drivers).toHaveLength(2);
      expect(drivers.find(d => d.id === 'max_verstappen')?.points).toBe(25);
      expect(drivers.find(d => d.id === 'hamilton')?.points).toBe(0);
    });
  });

  describe('fetchDriversFromOpenF1', () => {
    it('should fetch and map OpenF1 drivers', async () => {
      server.use(
        http.get(`https://api.openf1.org/v1/drivers`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('session_key') === '9159') {
            return HttpResponse.json([
              {
                name_acronym: 'VER',
                full_name: 'Max Verstappen',
                team_name: 'Red Bull Racing',
                driver_number: 1,
                team_colour: '3671C6'
              }
            ]);
          }
          return new HttpResponse(null, { status: 404 });
        })
      );

      const drivers = await fetchDriversFromOpenF1(9159);
      expect(drivers).toHaveLength(1);
      expect(drivers[0].id).toBe('max_verstappen');
      expect(drivers[0].color).toBe('#3671C6');
    });

    it('should handle error for OpenF1 API', async () => {
      server.use(
        http.get(`https://api.openf1.org/v1/drivers`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const drivers = await fetchDriversFromOpenF1(9159);
      expect(drivers).toHaveLength(0);
    });
  });

  describe('fetchQualifyingResults', () => {
    it('should return qualifying results on success', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/1/qualifying.json`, () => {
          return HttpResponse.json({
            MRData: {
              RaceTable: {
                Races: [{ QualifyingResults: [{ position: '1' }] }]
              }
            }
          });
        })
      );

      const results = await fetchQualifyingResults(2026, 1);
      expect(results).toHaveLength(1);
      expect(results[0].position).toBe('1');
    });

    it('should return empty array if no qualifying data', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/1/qualifying.json`, () => {
          return HttpResponse.json({
            MRData: {
              RaceTable: {
                Races: []
              }
            }
          });
        })
      );

      const results = await fetchQualifyingResults(2026, 1);
      expect(results).toHaveLength(0);
    });
  });

  describe('getP10DriverId', () => {
    it('should return the ID of the driver in P10', () => {
      const mockRace = {
        Results: [
          { position: '9', Driver: { driverId: 'driver9' } },
          { position: '10', Driver: { driverId: 'driver10' } },
          { position: '11', Driver: { driverId: 'driver11' } }
        ]
      } as unknown as ApiRace;

      expect(getP10DriverId(mockRace)).toBe('driver10');
    });

    it('should return null if P10 is missing', () => {
      const mockRace = {
        Results: [{ position: '1', Driver: { driverId: 'driver1' } }]
      } as unknown as ApiRace;

      expect(getP10DriverId(mockRace)).toBe(null);
    });
  });

  describe('getFirstDnfDriver', () => {
    it('should return the driver with the fewest laps who retired', () => {
      const mockRace = {
        Results: [
          { status: 'Finished', laps: '50', Driver: { driverId: 'winner' } },
          { status: 'Engine', laps: '5', Driver: { driverId: 'dnf1' } },
          { status: 'Collision', laps: '10', Driver: { driverId: 'dnf2' } },
          { status: '+1 Lap', laps: '49', Driver: { driverId: 'lapped' } },
          { status: 'Did not start', laps: '0', Driver: { driverId: 'dns' } }
        ]
      } as unknown as ApiRace;

      const dnf = getFirstDnfDriver(mockRace);
      expect(dnf?.driverId).toBe('dnf1');
    });

    it('should return null if everyone finished or was lapped', () => {
      const mockRace = {
        Results: [
          { status: 'Finished', laps: '50', Driver: { driverId: 'winner' } },
          { status: '+1 Lap', laps: '49', Driver: { driverId: 'lapped' } }
        ]
      } as unknown as ApiRace;

      expect(getFirstDnfDriver(mockRace)).toBe(null);
    });
  });
});

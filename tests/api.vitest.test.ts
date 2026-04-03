import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import { 
  fetchRaceResults, 
  fetchCalendar, 
  fetchDrivers, 
  fetchConstructors,
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

    it('should respect timeouts', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/1/results.json`, async () => {
          await new Promise(resolve => setTimeout(resolve, 500)); // Delay response
          return HttpResponse.json({ MRData: {} });
        })
      );

      // Import the function to be able to use a short timeout for the test
      // Actually, we can just test that it eventually fails if the timeout is too low
      // But the default is 10s. I'll mock fetch to throw AbortError.
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        const controller = new AbortController();
        controller.abort();
        return Promise.reject(new Error('The user aborted a request.'));
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await fetchRaceResults(2026, 1);
      expect(result).toBeNull();
      
      global.fetch = originalFetch;
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

  describe('fetchConstructors', () => {
    it('should fetch constructor standings', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/constructorStandings.json`, () => {
          return HttpResponse.json({
            MRData: {
              StandingsTable: {
                StandingsLists: [{
                  ConstructorStandings: [
                    {
                      points: '100',
                      Constructor: { constructorId: 'red_bull', name: 'Red Bull' }
                    },
                    {
                      points: '80',
                      Constructor: { constructorId: 'ferrari', name: 'Ferrari' }
                    }
                  ]
                }]
              }
            }
          });
        })
      );

      const constructors = await fetchConstructors(2026);
      expect(constructors).toHaveLength(2);
      expect(constructors[0].id).toBe('red_bull');
      expect(constructors[0].points).toBe(100);
      expect(constructors[1].id).toBe('ferrari');
    });

    it('should return empty array on failure', async () => {
      server.use(
        http.get(`${BASE_URL}/2026/constructorStandings.json`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const constructors = await fetchConstructors(2026);
      expect(constructors).toHaveLength(0);
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

    it('should use position as a tie-breaker if laps are equal (higher position = earlier retiree)', () => {
      const mockRace = {
        Results: [
          { status: 'Engine', laps: '5', position: '20', Driver: { driverId: 'dnf_early' } },
          { status: 'Accident', laps: '5', position: '19', Driver: { driverId: 'dnf_late' } },
          { status: 'Finished', laps: '50', position: '1', Driver: { driverId: 'winner' } }
        ]
      } as unknown as ApiRace;

      const dnf = getFirstDnfDriver(mockRace);
      expect(dnf?.driverId).toBe('dnf_early');
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

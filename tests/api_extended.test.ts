import assert from 'node:assert';
import * as api from '../lib/api';

console.log('\n🧪 Running Extended API Tests (with Mocks)...');

// Helper to mock global fetch
function mockFetch(responses: Record<string, any>) {
  global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    const urlStr = url.toString();
    const response = responses[Object.keys(responses).find(k => urlStr.includes(k)) || 'default'];
    
    return {
      ok: !!response,
      status: response ? 200 : 404,
      json: async () => response,
      headers: {
        get: (name: string) => name === 'content-type' ? 'application/json' : null
      }
    } as any;
  };
}

const originalFetch = global.fetch;

async function runTests() {
  try {
    // Test 1: fetchRaceResults
    mockFetch({
      'results.json': {
        MRData: {
          RaceTable: {
            Races: [{
              season: '2026',
              round: '1',
              raceName: 'Test GP',
              Circuit: { circuitName: 'Test Circuit' },
              date: '2026-03-08',
              Results: [{ position: '10', Driver: { driverId: 'verstappen' } }]
            }]
          }
        }
      }
    });
    
    const race = await api.fetchRaceResults(2026, 1);
    assert.ok(race, 'Should return a race');
    assert.strictEqual(race?.Results[0].Driver.driverId, 'verstappen');
    assert.strictEqual(api.getP10DriverId(race!), 'verstappen');
    console.log('  ✅ fetchRaceResults & getP10DriverId: Passed');

    // Test 2: fetchCalendar
    mockFetch({
      '2026.json': {
        MRData: {
          RaceTable: {
            Races: [
              { round: '1', raceName: 'GP1' },
              { round: '2', raceName: 'GP2' }
            ]
          }
        }
      }
    });
    const calendar = await api.fetchCalendar(2026);
    assert.strictEqual(calendar.length, 2);
    assert.strictEqual(calendar[0].raceName, 'GP1');
    console.log('  ✅ fetchCalendar: Passed');

    // Test 3: fetchDrivers (Complex merge logic)
    mockFetch({
      'driverStandings.json': {
        MRData: {
          StandingsTable: {
            StandingsLists: [{
              DriverStandings: [{
                points: '25',
                Driver: { driverId: 'norris', code: 'NOR', givenName: 'Lando', familyName: 'Norris', permanentNumber: '4' },
                Constructors: [{ constructorId: 'mclaren', name: 'McLaren' }]
              }]
            }]
          }
        }
      },
      '1/results.json': {
        MRData: {
          RaceTable: {
            Races: [{
              Results: [
                { Driver: { driverId: 'norris' }, number: '4', Constructor: { constructorId: 'mclaren', name: 'McLaren' } },
                { Driver: { driverId: 'piastri', code: 'PIA', givenName: 'Oscar', familyName: 'Piastri' }, number: '81', Constructor: { constructorId: 'mclaren', name: 'McLaren' } }
              ]
            }]
          }
        }
      }
    });

    const drivers = await api.fetchDrivers(2026);
    assert.strictEqual(drivers.length, 2, 'Should have 2 drivers (1 from standings, 1 from race results)');
    const norris = drivers.find(d => d.id === 'norris');
    const piastri = drivers.find(d => d.id === 'piastri');
    assert.strictEqual(norris?.points, 25);
    assert.strictEqual(norris?.number, 4);
    assert.strictEqual(piastri?.points, 0);
    assert.strictEqual(piastri?.number, 81);
    console.log('  ✅ fetchDrivers Merging: Passed');

    // Test 4: fetchDriversFromOpenF1
    mockFetch({
      'openf1.org': [
        { name_acronym: 'VER', full_name: 'Max Verstappen', team_name: 'Red Bull Racing', driver_number: 1, team_colour: '3671C6' },
        { name_acronym: 'UNK', full_name: 'Unknown Driver', team_name: 'Mystic Team', driver_number: 99, team_colour: null }
      ]
    });
    const openF1Drivers = await api.fetchDriversFromOpenF1(1234);
    assert.strictEqual(openF1Drivers.length, 2);
    assert.strictEqual(openF1Drivers[0].id, 'max_verstappen'); // Map from VER
    assert.strictEqual(openF1Drivers[1].id, 'unk'); // Fallback to lowercase acronym
    assert.strictEqual(openF1Drivers[1].color, '#B6BABD'); // Default color
    console.log('  ✅ fetchDriversFromOpenF1: Passed');

    // Test 5: fetchQualifyingResults
    mockFetch({
      'qualifying.json': {
        MRData: {
          RaceTable: {
            Races: [{
              QualifyingResults: [{ position: '1', Driver: { driverId: 'leclerc' } }]
            }]
          }
        }
      }
    });
    const quali = await api.fetchQualifyingResults(2026, 1);
    assert.strictEqual(quali.length, 1);
    assert.strictEqual(quali[0].Driver.driverId, 'leclerc');
    console.log('  ✅ fetchQualifyingResults: Passed');

    // Test 6: API Error Handling (Simulate failure)
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' })
    } as any);

    const errorRace = await api.fetchRaceResults(2026, 1);
    assert.strictEqual(errorRace, null, 'Should return null on non-ok response');
    
    const errorDrivers = await api.fetchDrivers(2026);
    assert.deepStrictEqual(errorDrivers, [], 'Should return empty array on failure');
    console.log('  ✅ API Error Handling: Passed');

  } catch (e) {
    console.error('  ❌ Extended API Test Failed:', e);
    process.exit(1);
  } finally {
    global.fetch = originalFetch;
  }
}

runTests();

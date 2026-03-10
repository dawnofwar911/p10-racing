import assert from 'node:assert';
import { getFirstDnfDriver, ApiRace } from '../lib/api';

console.log('\n🧪 Running Advanced API DNF Logic Tests...');

const createMockResult = (driverId: string, status: string, laps: string) => ({
  number: '1',
  position: '1',
  grid: '1',
  points: '0',
  Driver: {
    driverId,
    permanentNumber: '1',
    code: 'TST',
    givenName: 'Test',
    familyName: 'Driver'
  },
  Constructor: { constructorId: 'test', name: 'Test' },
  status,
  laps
});

try {
  // Test 1: Multiple DNFs - Should pick the one with fewest laps
  const race1: ApiRace = {
    season: '2026', round: '1', raceName: 'Test', Circuit: { circuitName: 'C' }, date: 'D',
    Results: [
      createMockResult('d1', 'Engine', '10'),
      createMockResult('d2', 'Gearbox', '5'), // This one
      createMockResult('d3', 'Collision', '20')
    ]
  };
  assert.strictEqual(getFirstDnfDriver(race1)?.driverId, 'd2');
  console.log('  ✅ Multiple DNFs (fewest laps): Passed');

  // Test 2: Status filtering
  const race2: ApiRace = {
    season: '2026', round: '1', raceName: 'Test', Circuit: { circuitName: 'C' }, date: 'D',
    Results: [
      createMockResult('dns', 'Did not start', '0'), // Ignored (0 laps)
      createMockResult('lapped', '+1 Lap', '56'),    // Ignored (Lapped)
      createMockResult('dq', 'Disqualified', '57'), // Ignored (Finished/Lapped equivalent in logic?) - Wait, DQ with 57 laps should be ignored if we only want retirements.
      createMockResult('dnf', 'Accident', '50')      // Pick this
    ]
  };
  assert.strictEqual(getFirstDnfDriver(race2)?.driverId, 'dnf');
  console.log('  ✅ DNF Filtering (DNS/Lapped/Finished): Passed');

  // Test 3: DQ with few laps
  const race3: ApiRace = {
    season: '2026', round: '1', raceName: 'Test', Circuit: { circuitName: 'C' }, date: 'D',
    Results: [
      createMockResult('dq', 'Disqualified', '5')
    ]
  };
  // Status 'Disqualified' doesn't contain 'finished', 'lap', 'not start', 'dns', 'qualify', 'withdrawn'.
  // And it has laps > 0. So it SHOULD be counted as DNF by current logic.
  assert.strictEqual(getFirstDnfDriver(race3)?.driverId, 'dq');
  console.log('  ✅ DQ with laps is DNF: Passed');

  // Test 4: Withdrawn/DNS with laps (should not happen but test logic)
  const race4: ApiRace = {
    season: '2026', round: '1', raceName: 'Test', Circuit: { circuitName: 'C' }, date: 'D',
    Results: [
      createMockResult('withdrawn', 'Withdrawn', '5')
    ]
  };
  assert.strictEqual(getFirstDnfDriver(race4), null, 'Withdrawn should be ignored even with laps');
  console.log('  ✅ Withdrawn is ignored: Passed');

} catch (e) {
  console.error('  ❌ Advanced API DNF Logic Test Failed:', e);
  process.exit(1);
}

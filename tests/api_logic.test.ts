import assert from 'node:assert';
import { getFirstDnfDriverId, ApiRace } from '../lib/api';

console.log('\n🧪 Running API Logic Tests...');

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

// Mock Race Data
const mockRace: ApiRace = {
  season: '2026',
  round: '1',
  raceName: 'Test GP',
  Results: [
    createMockResult('winner', 'Finished', '57'),
    createMockResult('lapped_driver', '+1 Lap', '56'),
    createMockResult('lapped_driver_2', 'Lapped', '55'), // "Lapped" status
    createMockResult('late_crash', 'Collision', '50'),
    createMockResult('early_engine', 'Engine', '5'), // Fewest laps, should be First DNF
    createMockResult('mid_accident', 'Accident', '20')
  ]
};

try {
  const firstDnf = getFirstDnfDriverId(mockRace);
  
  // Logic check:
  // 'winner' -> Finished (Ignore)
  // 'lapped_driver' -> +1 Lap (Ignore)
  // 'lapped_driver_2' -> Lapped (Ignore)
  // 'late_crash' -> Collision, 50 laps
  // 'early_engine' -> Engine, 5 laps  <-- WINNER (Lowest Laps)
  // 'mid_accident' -> Accident, 20 laps

  assert.strictEqual(firstDnf, 'early_engine', `Expected 'early_engine', got '${firstDnf}'`);
  console.log('  ✅ First DNF Identification (Standard): Passed');

} catch (e) {
  console.error('  ❌ First DNF Identification Failed:', e);
  process.exit(1);
}

// Test Case 2: No DNFs (Miami 2023 style)
const noDnfRace: ApiRace = {
  season: '2026',
  round: '2',
  raceName: 'Reliable GP',
  Results: [
    createMockResult('p1', 'Finished', '50'),
    createMockResult('p20', '+2 Laps', '48')
  ]
};

try {
  const result = getFirstDnfDriverId(noDnfRace);
  assert.strictEqual(result, null, `Expected null for no DNFs, got '${result}'`);
  console.log('  ✅ No DNF Scenario: Passed');
} catch (e) {
  console.error('  ❌ No DNF Scenario Failed:', e);
  process.exit(1);
}

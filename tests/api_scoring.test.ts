import assert from 'node:assert';
import { calculateTotalPoints } from '../lib/scoring';
import { getFirstDnfDriver, ApiRace } from '../lib/api';

console.log('\n🧪 Running API-to-Scoring Integration Tests...');

// 1. Mock API Data from a finished race
const mockApiRace: ApiRace = {
  season: '2026',
  round: '1',
  raceName: 'Australian GP',
  Results: [
    { number: '63', position: '1', status: 'Finished', laps: '58', Driver: { driverId: 'russell', permanentNumber: '63', code: 'RUS', givenName: 'G', familyName: 'R' }, Constructor: { constructorId: 'mercedes', name: 'M' }, grid: '1', points: '25' },
    { number: '1',  position: '5', status: 'Finished', laps: '58', Driver: { driverId: 'norris', permanentNumber: '4', code: 'NOR', givenName: 'L', familyName: 'N' }, Constructor: { constructorId: 'mclaren', name: 'M' }, grid: '1', points: '10' },
    { number: '10', position: '10', status: 'Finished', laps: '57', Driver: { driverId: 'gasly', permanentNumber: '10', code: 'GAS', givenName: 'P', familyName: 'G' }, Constructor: { constructorId: 'alpine', name: 'A' }, grid: '1', points: '1' },
    { number: '14', position: '18', status: 'Retired', laps: '21', Driver: { driverId: 'alonso', permanentNumber: '14', code: 'ALO', givenName: 'F', familyName: 'A' }, Constructor: { constructorId: 'aston', name: 'A' }, grid: '1', points: '0' },
    { number: '81', position: '21', status: 'Did not start', laps: '0', Driver: { driverId: 'piastri', permanentNumber: '81', code: 'PIA', givenName: 'O', familyName: 'P' }, Constructor: { constructorId: 'mclaren', name: 'M' }, grid: '1', points: '0' }
  ]
};

// 2. Mock User Prediction
const userPrediction = {
  p10: 'norris', // Predicted Norris would be P10. In reality he was P5.
  dnf: 'alonso'  // Predicted Alonso would be First DNF. Correct!
};

// 3. Process API data to find actuals (Simplified Leaderboard Logic)
const raceActuals = {
  positions: mockApiRace.Results.reduce((acc: any, r: any) => {
    acc[r.Driver.driverId] = parseInt(r.position);
    return acc;
  }, {}),
  firstDnf: getFirstDnfDriver(mockApiRace)?.driverId || null
};

try {
  // Test DNF Identification logic used in scoring
  assert.strictEqual(raceActuals.firstDnf, 'alonso', 'Should ignore Piastri (DNS) and pick Alonso');
  console.log('  ✅ DNF filtering excludes DNS: Passed');

  // Test Points Calculation
  // P10 Points: User predicted Norris. Norris finished P5. 
  // P5 to P10 distance is 5. According to lib/scoring.ts, distance 5 = 8 points.
  const p10Points = calculateTotalPoints(userPrediction.p10, raceActuals.positions[userPrediction.p10], "user_pick", "actual_dnf_mismatch");
  assert.strictEqual(p10Points, 8, `Expected 8 points for Norris in P5, got ${p10Points}`);
  
  // DNF Points: Correct (25 pts)
  const dnfPoints = userPrediction.dnf === raceActuals.firstDnf ? 25 : 0;
  assert.strictEqual(dnfPoints, 25, 'Expected 25 points for correct DNF');

  assert.strictEqual(p10Points + dnfPoints, 33, 'Total should be 33');
  console.log('  ✅ API Result to Scoring Logic: Passed');

} catch (e) {
  console.error('  ❌ API Scoring Test Failed:', e);
  process.exit(1);
}

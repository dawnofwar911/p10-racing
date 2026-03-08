import assert from 'node:assert';
import { calculateP10Points, calculateDnfPoints, calculateTotalPoints } from '../lib/scoring';

console.log('🧪 Running Scoring Logic Tests...');

// 1. P10 Distance Logic
// Points: 0=>25, 1=>18, 2=>15, 3=>12, 4=>10, 5=>8, 6=>6, 7=>4, 8=>2, 9=>1, 10+=>0

try {
  // Exact Match (P10)
  assert.strictEqual(calculateP10Points(10), 25, 'P10 should equal 25 points');
  
  // 1 Away (P9, P11)
  assert.strictEqual(calculateP10Points(9), 18, 'P9 should equal 18 points');
  assert.strictEqual(calculateP10Points(11), 18, 'P11 should equal 18 points');

  // 2 Away (P8, P12)
  assert.strictEqual(calculateP10Points(8), 15, 'P8 should equal 15 points');
  assert.strictEqual(calculateP10Points(12), 15, 'P12 should equal 15 points');

  // Edge of points (9 away -> P1, P19)
  assert.strictEqual(calculateP10Points(1), 1, 'P1 should equal 1 point');
  assert.strictEqual(calculateP10Points(19), 1, 'P19 should equal 1 point');

  // No points (10+ away -> P20)
  assert.strictEqual(calculateP10Points(20), 0, 'P20 should equal 0 points');

  console.log('  ✅ P10 Calculation Tests Passed');
} catch (e) {
  console.error('  ❌ P10 Calculation Test Failed:', e);
  process.exit(1);
}

// 2. DNF Logic
try {
  // Correct Prediction
  assert.strictEqual(calculateDnfPoints('verstappen', 'verstappen'), 25, 'Correct DNF should be 25 points');
  
  // Incorrect Prediction
  assert.strictEqual(calculateDnfPoints('verstappen', 'hamilton'), 0, 'Incorrect DNF should be 0 points');
  
  // No DNF happened (actual is empty/null string)
  assert.strictEqual(calculateDnfPoints('verstappen', ''), 0, 'Prediction vs No DNF should be 0 points');

  console.log('  ✅ DNF Calculation Tests Passed');
} catch (e) {
  console.error('  ❌ DNF Calculation Test Failed:', e);
  process.exit(1);
}

// 3. Integration (Total Points)
try {
  // Scenario: Close P10 (P12 -> 15pts) + Correct DNF (25pts) = 40pts
  const total = calculateTotalPoints('driverA', 12, 'driverB', 'driverB');
  assert.strictEqual(total, 40, 'Total calculation mismatch');
  
  // Check for placeholder matching (to avoid 25-pt freebie bug)
  // If we pass identical placeholders for predicted and actual DNF, it incorrectly awards points
  const noMatch = calculateTotalPoints('driverA', 12, 'user_p10_id', 'actual_dnf_id');
  assert.strictEqual(noMatch, 15, '12 is 2 distance from 10, so 15 points. DNF mismatch = 0 points.');
  
  const placeholders = calculateTotalPoints('driverA', 10, '', '');
  assert.strictEqual(placeholders, 25, 'Empty/missing DNF should not award 25 points if they match as empty');
  
  console.log('  ✅ Total Score Integration Passed');
} catch (e) {
  console.error('  ❌ Total Score Test Failed:', e);
  process.exit(1);
}

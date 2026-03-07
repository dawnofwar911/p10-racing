import assert from 'node:assert';

console.log('\n🧪 Running Prediction Locking Tests...');

function isPredictionLocked(now: Date, raceDate: string, raceTime: string): boolean {
  const raceStartTime = new Date(`${raceDate}T${raceTime}`);
  const lockTime = new Date(raceStartTime.getTime() + 120000); // 2 minutes after start
  return now > lockTime;
}

try {
  // Test Case 1: Long before the race
  const now1 = new Date('2026-03-14T10:00:00Z');
  const locked1 = isPredictionLocked(now1, '2026-03-15', '05:00:00Z');
  assert.strictEqual(locked1, false, 'Should NOT be locked 1 day before');

  // Test Case 2: Exactly at start time (should NOT be locked anymore)
  const now2 = new Date('2026-03-15T05:00:00Z');
  const locked2 = isPredictionLocked(now2, '2026-03-15', '05:00:00Z');
  assert.strictEqual(locked2, false, 'Should NOT be locked exactly at start time');

  // Test Case 3: 1 minute after start (should NOT be locked)
  const now3 = new Date('2026-03-15T05:01:00Z');
  const locked3 = isPredictionLocked(now3, '2026-03-15', '05:00:00Z');
  assert.strictEqual(locked3, false, 'Should NOT be locked 1 minute after start');

  // Test Case 4: 2 minutes 1 second after start (should be locked)
  const now4 = new Date('2026-03-15T05:02:01Z');
  const locked4 = isPredictionLocked(now4, '2026-03-15', '05:00:00Z');
  assert.strictEqual(locked4, true, 'Should be locked 2 mins 1 sec after start');

  console.log('  ✅ Locking Logic Tests Passed');
} catch (e) {
  console.error('  ❌ Locking Logic Test Failed:', e);
  process.exit(1);
}

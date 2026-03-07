import assert from 'node:assert';

console.log('\n🧪 Running Active Race Logic Tests...');

interface Race {
  round: string;
  date: string;
  time: string;
  raceName: string;
}

/**
 * Logic extracted from PredictPage to find the "active" index.
 */
function getActiveRaceIndex(now: Date, races: any[], fetchResults: (round: number) => any): number {
  // Find first race in the future
  let activeIndex = races.findIndex(r => {
    const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
    return raceTime > now;
  });

  if (activeIndex === -1) activeIndex = races.length - 1;

  // Check if the previous race (the one that just happened) has results
  if (activeIndex > 0) {
    const prevRace = races[activeIndex - 1];
    const results = fetchResults(parseInt(prevRace.round));
    if (!results) {
      // No results yet! Keep showing the race that just happened
      return activeIndex - 1;
    }
  }

  return activeIndex;
}

// Setup
const races = [
  { round: '1', date: '2026-03-01', time: '10:00:00Z', raceName: 'Bahrain' },
  { round: '2', date: '2026-03-15', time: '05:00:00Z', raceName: 'Australia' },
  { round: '3', date: '2026-04-05', time: '05:00:00Z', raceName: 'Japan' }
];

try {
  // Test 1: Well before Australia (Round 2)
  const now1 = new Date('2026-03-10T10:00:00Z');
  const idx1 = getActiveRaceIndex(now1, races, (r) => (r === 1 ? { Results: [] } : null));
  assert.strictEqual(idx1, 1, 'Should target Round 2 (Australia) when it is the next race');
  console.log('  ✅ Future Race Target: Passed');

  // Test 2: Australia has started, but no results yet.
  const now2 = new Date('2026-03-15T08:00:00Z'); 
  const idx2 = getActiveRaceIndex(now2, races, (r) => {
    if (r === 1) return { Results: [] }; 
    if (r === 2) return null; 
    return null;
  });
  assert.strictEqual(idx2, 1, 'Should STAY on Round 2 if no results are published yet');
  console.log('  ✅ Stay on Current (No Results): Passed');

  // Test 3: Australia has results! Now we can move to Japan (Round 3).
  const now3 = new Date('2026-03-15T12:00:00Z');
  const idx3 = getActiveRaceIndex(now3, races, (r) => {
    if (r === 1) return { Results: [] };
    if (r === 2) return { Results: [] }; 
    return null;
  });
  assert.strictEqual(idx3, 2, 'Should move to Round 3 once Round 2 results are out');
  console.log('  ✅ Move to Next (Results Found): Passed');

  console.log('  ✅ Active Race Logic Tests Passed');
} catch (e) {
  console.error('  ❌ Active Race Logic Test Failed:', e);
  process.exit(1);
}

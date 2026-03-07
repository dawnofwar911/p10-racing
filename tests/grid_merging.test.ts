import assert from 'node:assert';

console.log('\n🧪 Running Grid Merging Logic Tests...');

interface GridEntry {
  position: string;
  number: string;
  Driver: {
    driverId: string;
    code: string;
  };
}

/**
 * Logic extracted from PredictPage to merge Quali grid with all drivers.
 */
function mergeGrid(qualiGrid: any[], allDrivers: any[]): GridEntry[] {
  const presentIds = new Set(qualiGrid.map(q => q.Driver.driverId));
  const missing = allDrivers.filter(d => !presentIds.has(d.id));
  
  const finalGrid = [...qualiGrid];
  missing.forEach((d, i) => {
    finalGrid.push({
      position: (qualiGrid.length + i + 1).toString(),
      number: d.number.toString(),
      Driver: {
        driverId: d.id,
        code: d.code
      }
    });
  });
  return finalGrid;
}

// Setup
const allDrivers = [
  { id: 'norris', code: 'NOR', number: 1 },
  { id: 'piastri', code: 'PIA', number: 81 },
  { id: 'verstappen', code: 'VER', number: 3 },
  { id: 'sainz', code: 'SAI', number: 55 }
];

try {
  // Test 1: Full grid available in Quali
  const quali1 = [
    { position: '1', Driver: { driverId: 'norris', code: 'NOR' }, number: '1' },
    { position: '2', Driver: { driverId: 'piastri', code: 'PIA' }, number: '81' },
    { position: '3', Driver: { driverId: 'verstappen', code: 'VER' }, number: '3' },
    { position: '4', Driver: { driverId: 'sainz', code: 'SAI' }, number: '55' }
  ];
  const res1 = mergeGrid(quali1, allDrivers);
  assert.strictEqual(res1.length, 4, 'Should have 4 drivers');
  assert.strictEqual(res1[0].Driver.driverId, 'norris');
  console.log('  ✅ Full Quali Grid: Passed');

  // Test 2: Missing drivers in Quali (Australian GP style)
  const quali2 = [
    { position: '1', Driver: { driverId: 'norris', code: 'NOR' }, number: '1' },
    { position: '2', Driver: { driverId: 'piastri', code: 'PIA' }, number: '81' }
  ];
  // Missing: verstappen, sainz
  const res2 = mergeGrid(quali2, allDrivers);
  assert.strictEqual(res2.length, 4, 'Should have 4 drivers even if 2 missing from quali');
  assert.strictEqual(res2[2].position, '3', 'First missing driver should be P3');
  assert.strictEqual(res2[2].Driver.driverId, 'verstappen');
  assert.strictEqual(res2[3].position, '4', 'Second missing driver should be P4');
  assert.strictEqual(res2[3].Driver.driverId, 'sainz');
  console.log('  ✅ Missing Drivers Appended: Passed');

  console.log('  ✅ Grid Merging Logic Tests Passed');
} catch (e) {
  console.error('  ❌ Grid Merging Logic Test Failed:', e);
  process.exit(1);
}

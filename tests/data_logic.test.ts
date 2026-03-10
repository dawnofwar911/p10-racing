import assert from 'node:assert';
import { isPreseason, DRIVERS, RACES } from '../lib/data';

console.log('\n🧪 Running Data Logic Tests...');

try {
  // Test 1: isPreseason boundaries
  assert.strictEqual(isPreseason(new Date('2026-01-15')), true, 'January should be preseason');
  assert.strictEqual(isPreseason(new Date('2026-02-28')), true, 'February should be preseason');
  assert.strictEqual(isPreseason(new Date('2026-03-01')), false, 'March should NOT be preseason');
  assert.strictEqual(isPreseason(new Date('2026-12-31')), false, 'December should NOT be preseason');
  console.log('  ✅ isPreseason (Parameterized): Passed');

  // Test 2: Static Data Integrity
  assert.ok(DRIVERS.length >= 20, 'Should have at least 20 drivers');
  const norris = DRIVERS.find(d => d.id === 'norris');
  assert.strictEqual(norris?.code, 'NOR', 'Norris should have code NOR');
  
  assert.ok(RACES.length > 0, 'Should have at least one race');
  console.log('  ✅ Static Data Integrity: Passed');

} catch (e) {
  console.error('  ❌ Data Logic Test Failed:', e);
  process.exit(1);
}

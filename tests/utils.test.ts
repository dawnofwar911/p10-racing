import assert from 'node:assert';
import { getContrastColor } from '../lib/utils/colors';

console.log('\n🧪 Running Color Utility Tests...');

try {
  // Test Black backgrounds (should return white)
  assert.strictEqual(getContrastColor('#000000'), 'white', 'Black background should have white text');
  assert.strictEqual(getContrastColor('#3671C6'), 'white', 'Red Bull Blue background should have white text');
  assert.strictEqual(getContrastColor('#E80020'), 'white', 'Ferrari Red background should have white text');
  assert.strictEqual(getContrastColor('#229971'), 'white', 'Aston Martin Green background should have white text');

  // Test White backgrounds (should return black)
  assert.strictEqual(getContrastColor('#FFFFFF'), 'black', 'White background should have black text');
  assert.strictEqual(getContrastColor('#ffffff'), 'black', 'White background (lowercase) should have black text');
  assert.strictEqual(getContrastColor('#27F4D2'), 'black', 'Mercedes Teal background should have black text');
  assert.strictEqual(getContrastColor('#FF8000'), 'black', 'McLaren Orange background should have black text');
  assert.strictEqual(getContrastColor('#B6BABD'), 'black', 'Haas Grey background should have black text');

  // Test 3-digit hex
  assert.strictEqual(getContrastColor('#000'), 'white', '3-digit Black background should have white text');
  assert.strictEqual(getContrastColor('#FFF'), 'black', '3-digit White background should have black text');

  // Test without hash
  assert.strictEqual(getContrastColor('000000'), 'white', 'Black background without hash should have white text');
  assert.strictEqual(getContrastColor('FFFFFF'), 'black', 'White background without hash should have black text');

  console.log('  ✅ getContrastColor: Passed');
} catch (e) {
  console.error('  ❌ Color Utility Test Failed:', e);
  process.exit(1);
}

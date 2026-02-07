import assert from 'node:assert';
import { TEAM_COLORS } from '../lib/api';

console.log('\n🧪 Running Data Integrity Tests...');

const KNOWN_2026_TEAMS = [
  'red_bull', 'ferrari', 'mclaren', 'mercedes', 
  'aston_martin', 'alpine', 'williams', 'rb', 
  'audi', 'haas', 'cadillac'
];

try {
  // 1. Check Color Coverage
  KNOWN_2026_TEAMS.forEach(teamId => {
    assert.ok(TEAM_COLORS[teamId], `Missing color definition for team: ${teamId}`);
    assert.match(TEAM_COLORS[teamId], /^#[0-9A-Fa-f]{6}$/, `Invalid hex color for ${teamId}: ${TEAM_COLORS[teamId]}`);
  });
  console.log('  ✅ 2026 Team Color Coverage: Passed');

  // 2. Check for unexpected duplicate colors (Optional but good for UX)
  const colors = Object.values(TEAM_COLORS);
  const uniqueColors = new Set(colors);
  if (colors.length !== uniqueColors.size) {
    console.warn('  ⚠️ Note: Some teams share the same brand color (e.g. Audi/Haas might be similar)');
  }

  console.log('  ✅ Team Color Integrity: Passed');
} catch (e) {
  console.error('  ❌ Integrity Test Failed:', e);
  process.exit(1);
}

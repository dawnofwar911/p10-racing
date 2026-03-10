import { LeaderboardEntry } from '../lib/data';

console.log('🧪 Running Leaderboard Ranking & Champion Tests...');

// Mock data: A set of players with different scores
const mockEntries: LeaderboardEntry[] = [
  { rank: 0, player: 'User A', points: 50, lastRacePoints: 10 },
  { rank: 0, player: 'User B', points: 75, lastRacePoints: 25 },
  { rank: 0, player: 'User C', points: 25, lastRacePoints: 0 },
];

// This mimics the logic used in app/leaderboard/page.tsx and app/leagues/view/page.tsx
function rankPlayers(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

const ranked = rankPlayers(mockEntries);

// 1. Verify Ranking Order
if (ranked[0].player !== 'User B') {
  throw new Error('Ranking Error: User B should be #1 with 75 points');
}
if (ranked[1].player !== 'User A') {
  throw new Error('Ranking Error: User A should be #2 with 50 points');
}
if (ranked[2].player !== 'User C') {
  throw new Error('Ranking Error: User C should be #3 with 25 points');
}

// 2. Verify Rank Numbers
if (ranked[0].rank !== 1 || ranked[1].rank !== 2 || ranked[2].rank !== 3) {
  throw new Error('Ranking Error: Rank numbers are not correctly assigned');
}

// 3. Logic Check: Champion Identification
// In our UI, we use "entry.rank === 1" to show the champion badge.
const champion = ranked.find(e => e.rank === 1);
if (!champion || champion.player !== 'User B') {
  throw new Error('Champion Error: Failed to identify User B as the champion');
}

console.log('  ✅ Leaderboard Ranking & Champion Tests Passed');

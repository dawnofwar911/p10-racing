import { describe, it, expect } from 'vitest';
import { LeaderboardEntry } from '@/lib/data';

function rankPlayers(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

describe('Leaderboard Ranking Logic', () => {
  const mockEntries: LeaderboardEntry[] = [
    { rank: 0, player: 'User A', points: 50, lastRacePoints: 10 },
    { rank: 0, player: 'User B', points: 75, lastRacePoints: 25 },
    { rank: 0, player: 'User C', points: 25, lastRacePoints: 0 },
  ];

  it('should rank players based on points in descending order', () => {
    const ranked = rankPlayers(mockEntries);
    expect(ranked[0].player).toBe('User B');
    expect(ranked[1].player).toBe('User A');
    expect(ranked[2].player).toBe('User C');
  });

  it('should assign correct rank numbers starting from 1', () => {
    const ranked = rankPlayers(mockEntries);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
  });

  it('should identify the champion as the player with rank 1', () => {
    const ranked = rankPlayers(mockEntries);
    const champion = ranked.find(e => e.rank === 1);
    expect(champion?.player).toBe('User B');
  });
});

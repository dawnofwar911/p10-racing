/**
 * P10 Racing - Achievement System Definitions
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or Lucide icon name
  color: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'perfect_weekend',
    name: 'Perfect Weekend',
    description: 'Guess both P10 and First DNF correctly in a single race.',
    icon: '🏆',
    color: '#e10600'
  },
  {
    id: 'midfield_master',
    name: 'Midfield Master',
    description: 'Guess the exact P10 finisher in 3 different races.',
    icon: '🎯',
    color: '#FFD700'
  },
  {
    id: 'point_scorer',
    name: 'Point Scorer',
    description: 'Earn points in 5 consecutive races.',
    icon: '🔥',
    color: '#FF8C00'
  },
  {
    id: 'consistent_performer',
    name: 'Consistent Performer',
    description: 'Earn points in 10 total races across the season.',
    icon: '📈',
    color: '#1E90FF'
  },
  {
    id: 'survivor',
    name: 'Survivor',
    description: 'Correctly predict a DNF in a race with at least 3 retirements.',
    icon: '🛠️',
    color: '#8B0000'
  }
];

export interface UnlockedAchievement {
  achievementId: string;
  unlockedAt: string; // ISO Date
  round?: string; // Round where it was unlocked
}

/**
 * Evaluates a player's history to find newly unlocked achievements.
 */
export function evaluateAchievements(
  history: { 
    round: string, 
    points: number, 
    p10Pos: number, 
    dnfCorrect: boolean,
    totalSoFar: number 
  }[]
): string[] {
  const unlockedIds: string[] = [];

  // 1. Perfect Weekend
  if (history.some(h => h.p10Pos === 10 && h.dnfCorrect)) {
    unlockedIds.push('perfect_weekend');
  }

  // 2. Midfield Master (3 exact P10s)
  const exactP10Count = history.filter(h => h.p10Pos === 10).length;
  if (exactP10Count >= 3) {
    unlockedIds.push('midfield_master');
  }

  // 3. Point Scorer (5 consecutive races with points > 0)
  let consecutivePoints = 0;
  let maxConsecutive = 0;
  history.forEach(h => {
    if (h.points > 0) {
      consecutivePoints++;
      maxConsecutive = Math.max(maxConsecutive, consecutivePoints);
    } else {
      consecutivePoints = 0;
    }
  });
  if (maxConsecutive >= 5) {
    unlockedIds.push('point_scorer');
  }

  // 4. Consistent Performer (10 total races with points > 0)
  const totalRacesWithPoints = history.filter(h => h.points > 0).length;
  if (totalRacesWithPoints >= 10) {
    unlockedIds.push('consistent_performer');
  }

  // Note: 'survivor' requires more data (total retirements per race) 
  // which might not be in the basic history object.
  // We can add it if we enhance the history transformation.

  return unlockedIds;
}

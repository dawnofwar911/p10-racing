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
    id: 'bullseye',
    name: 'Bullseye',
    description: 'Guess the exact P10 finisher (25 pts) for the first time.',
    icon: '🎯',
    color: '#e10600'
  },
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
    icon: '👑',
    color: '#FFD700'
  },
  {
    id: 'midfield_streak',
    name: 'Midfield Streak',
    description: 'Finish in the "Midfield Zone" (P8–P12) for 3 consecutive races.',
    icon: '🔥',
    color: '#FF8C00'
  },
  {
    id: 'season_pro',
    name: 'Season Professional',
    description: 'Earn double-digit points (10+) in 10 different races.',
    icon: '📈',
    color: '#1E90FF'
  },
  {
    id: 'centurion',
    name: 'The Centurion',
    description: 'Reach 100 total points in a single season.',
    icon: '💯',
    color: '#4CAF50'
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

  // 1. Bullseye (First exact P10)
  if (history.some(h => h.p10Pos === 10)) {
    unlockedIds.push('bullseye');
  }

  // 2. Perfect Weekend
  if (history.some(h => h.p10Pos === 10 && h.dnfCorrect)) {
    unlockedIds.push('perfect_weekend');
  }

  // 3. Midfield Master (3 exact P10s)
  const exactP10Count = history.filter(h => h.p10Pos === 10).length;
  if (exactP10Count >= 3) {
    unlockedIds.push('midfield_master');
  }

  // 4. Midfield Streak (3 consecutive races within 2 pos of P10)
  let consecutiveMidfield = 0;
  let maxConsecutive = 0;
  history.forEach(h => {
    // Distance of 2 from P10 (P8-P12)
    if (Math.abs(h.p10Pos - 10) <= 2) { // Criteria: P10 position within +/- 2 (P8-P12)
      consecutiveMidfield++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMidfield);
    } else {
      consecutiveMidfield = 0;
    }
  });
  if (maxConsecutive >= 3) {
    unlockedIds.push('midfield_streak');
  }

  // 5. Season Professional (10 total races within 4 pos of P10)
  const totalRacesHighQuality = history.filter(h => Math.abs(h.p10Pos - 10) <= 4).length; // Criteria: P10 position within +/- 4 (P6-P14)
  if (totalRacesHighQuality >= 10) {
    unlockedIds.push('season_pro');
  }

  // 6. The Centurion (100 total points)
  if (history.length > 0 && history[history.length - 1].totalSoFar >= 100) {
    unlockedIds.push('centurion');
  }

  return unlockedIds;
}

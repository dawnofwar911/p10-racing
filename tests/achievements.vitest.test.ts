import { describe, it, expect } from 'vitest';
import { evaluateAchievements } from '@/lib/achievements';

describe('Achievement Evaluation Logic', () => {
  it('identifies a Perfect Weekend', () => {
    const history = [
      { round: '1', points: 50, p10Pos: 10, dnfCorrect: true, totalSoFar: 50 }
    ];
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('perfect_weekend');
  });

  it('identifies Midfield Master (3 exact P10s)', () => {
    const history = [
      { round: '1', points: 25, p10Pos: 10, dnfCorrect: false, totalSoFar: 25 },
      { round: '2', points: 25, p10Pos: 10, dnfCorrect: false, totalSoFar: 50 },
      { round: '3', points: 25, p10Pos: 10, dnfCorrect: false, totalSoFar: 75 }
    ];
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('midfield_master');
  });

  it('identifies Point Scorer (5 consecutive races with points)', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      round: (i + 1).toString(),
      points: 10,
      p10Pos: 14,
      dnfCorrect: false,
      totalSoFar: (i + 1) * 10
    }));
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('point_scorer');
  });

  it('does not award point_scorer if not consecutive', () => {
    const history = [
      { round: '1', points: 10, p10Pos: 14, dnfCorrect: false, totalSoFar: 10 },
      { round: '2', points: 10, p10Pos: 14, dnfCorrect: false, totalSoFar: 20 },
      { round: '3', points: 0, p10Pos: 1, dnfCorrect: false, totalSoFar: 20 }, // Gap
      { round: '4', points: 10, p10Pos: 14, dnfCorrect: false, totalSoFar: 30 },
      { round: '5', points: 10, p10Pos: 14, dnfCorrect: false, totalSoFar: 40 }
    ];
    const unlocked = evaluateAchievements(history);
    expect(unlocked).not.toContain('point_scorer');
  });

  it('identifies Consistent Performer (10 total races with points)', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      round: (i + 1).toString(),
      points: 1,
      p10Pos: 1,
      dnfCorrect: false,
      totalSoFar: i + 1
    }));
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('consistent_performer');
  });
});

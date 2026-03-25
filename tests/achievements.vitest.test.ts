import { describe, it, expect } from 'vitest';
import { evaluateAchievements } from '@/lib/achievements';

describe('Achievement Evaluation Logic', () => {
  it('identifies Bullseye (First exact P10)', () => {
    const history = [
      { round: '1', points: 25, p10Pos: 10, dnfCorrect: false, totalSoFar: 25 }
    ];
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('bullseye');
  });

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

  it('identifies Midfield Streak (3 consecutive races within 2 pos of P10)', () => {
    const history = [
      { round: '1', points: 15, p10Pos: 12, dnfCorrect: false, totalSoFar: 15 },
      { round: '2', points: 18, p10Pos: 9, dnfCorrect: false, totalSoFar: 33 },
      { round: '3', points: 25, p10Pos: 10, dnfCorrect: false, totalSoFar: 58 }
    ];
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('midfield_streak');
  });

  it('does not award midfield_streak if not within 2 pos', () => {
    const history = [
      { round: '1', points: 15, p10Pos: 12, dnfCorrect: false, totalSoFar: 15 },
      { round: '2', points: 1, p10Pos: 1, dnfCorrect: false, totalSoFar: 16 }, // Out of zone
      { round: '3', points: 15, p10Pos: 8, dnfCorrect: false, totalSoFar: 31 }
    ];
    const unlocked = evaluateAchievements(history);
    expect(unlocked).not.toContain('midfield_streak');
  });

  it('identifies Season Professional (10 total races within 4 pos of P10)', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      round: (i + 1).toString(),
      points: 10,
      p10Pos: 14, // exactly distance 4
      dnfCorrect: false,
      totalSoFar: (i + 1) * 10
    }));
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('season_pro');
  });

  it('identifies The Centurion (100 total points)', () => {
    const history = [
      { round: '1', points: 50, p10Pos: 10, dnfCorrect: true, totalSoFar: 100 }
    ];
    const unlocked = evaluateAchievements(history);
    expect(unlocked).toContain('centurion');
  });
});

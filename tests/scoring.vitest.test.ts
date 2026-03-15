import { describe, it, expect } from 'vitest';
import { calculateP10Points, calculateDnfPoints, calculateTotalPoints, calculateSeasonPoints } from '@/lib/scoring';
import { SimplifiedResults } from '@/lib/types';

describe('Scoring Logic Tests', () => {
  describe('P10 Calculation', () => {
    it('should award 25 points for an exact P10 match', () => {
      expect(calculateP10Points(10)).toBe(25);
    });

    it('should award 18 points for 1 distance away (P9, P11)', () => {
      expect(calculateP10Points(9)).toBe(18);
      expect(calculateP10Points(11)).toBe(18);
    });

    it('should award 15 points for 2 distance away (P8, P12)', () => {
      expect(calculateP10Points(8)).toBe(15);
      expect(calculateP10Points(12)).toBe(15);
    });

    it('should award 1 point for extreme distances (P1, P19, P20)', () => {
      expect(calculateP10Points(1)).toBe(1);
      expect(calculateP10Points(19)).toBe(1);
      expect(calculateP10Points(20)).toBe(1);
    });
  });

  describe('DNF Calculation', () => {
    it('should award 25 points for a correct DNF prediction', () => {
      expect(calculateDnfPoints('verstappen', 'verstappen')).toBe(25);
    });

    it('should award 0 points for an incorrect DNF prediction', () => {
      expect(calculateDnfPoints('verstappen', 'hamilton')).toBe(0);
    });

    it('should award 0 points if no DNF happened but one was predicted', () => {
      expect(calculateDnfPoints('verstappen', '')).toBe(0);
    });
  });

  describe('Total Points Integration', () => {
    it('should correctly sum P10 and DNF points', () => {
      // Scenario: Close P10 (P12 -> 15pts) + Correct DNF (25pts) = 40pts
      const total = calculateTotalPoints('driverA', 12, 'driverB', 'driverB');
      expect(total).toBe(40);
    });

    it('should not award points for matching empty strings or placeholders', () => {
      const placeholders = calculateTotalPoints('driverA', 10, '', '');
      expect(placeholders).toBe(25); // Just 25 from P10, DNF should be 0
    });
  });

  describe('Season Points & History', () => {
    const mockResults: { [round: string]: SimplifiedResults & { date: Date } } = {
      '1': { positions: { 'verstappen': 10, 'hamilton': 1 }, firstDnf: 'perez', date: new Date('2026-03-15T05:00:00Z') },
      '2': { positions: { 'leclerc': 10, 'norris': 2 }, firstDnf: 'alonso', date: new Date('2026-03-22T10:00:00Z') }
    };

    const mockPredictions = {
      '1': { p10: 'verstappen', dnf: 'perez' }, // 25 + 25 = 50
      '2': { p10: 'leclerc', dnf: 'stroll' }    // 25 + 0 = 25
    };

    it('should calculate total points and detailed history', () => {
      const result = calculateSeasonPoints(mockPredictions, mockResults as any);
      expect(result.totalPoints).toBe(75);
      expect(result.history.length).toBe(2);
      expect(result.history[0].points).toBe(50);
      expect(result.history[1].points).toBe(25);
      expect(result.history[0].totalSoFar).toBe(50);
      expect(result.history[1].totalSoFar).toBe(75);
      expect(result.history[0].dnfCorrect).toBe(true);
      expect(result.history[1].dnfCorrect).toBe(false);
    });

    it('should filter results based on minDate (League Creation Date)', () => {
      // League created AFTER Round 1 but BEFORE Round 2
      const leagueCreated = new Date('2026-03-20T00:00:00Z');
      const result = calculateSeasonPoints(mockPredictions, mockResults as any, leagueCreated);
      
      expect(result.totalPoints).toBe(25); // Only Round 2
      expect(result.history.length).toBe(1);
      expect(result.history[0].round).toBe('2');
    });

    it('should handle missing predictions for a round', () => {
      const partialPredictions = {
        '2': { p10: 'leclerc', dnf: 'alonso' } // 25 + 25 = 50
      };
      const result = calculateSeasonPoints(partialPredictions, mockResults as any);
      expect(result.totalPoints).toBe(50);
      expect(result.history.length).toBe(1);
      expect(result.history[0].round).toBe('2');
    });
  });
});

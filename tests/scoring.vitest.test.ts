import { describe, it, expect } from 'vitest';
import { calculateP10Points, calculateDnfPoints, calculateTotalPoints } from '@/lib/scoring';

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
});

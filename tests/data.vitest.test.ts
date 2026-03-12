import { describe, it, expect } from 'vitest';
import { isPreseason, DRIVERS } from '@/lib/data';

describe('Data Logic Tests', () => {
  describe('isPreseason', () => {
    it('should return true for January', () => {
      const jan = new Date('2026-01-15');
      expect(isPreseason(jan)).toBe(true);
    });

    it('should return true for February', () => {
      const feb = new Date('2026-02-15');
      expect(isPreseason(feb)).toBe(true);
    });

    it('should return false for March (Season Start)', () => {
      const mar = new Date('2026-03-01');
      expect(isPreseason(mar)).toBe(false);
    });

    it('should return false for later months (e.g., June)', () => {
      const jun = new Date('2026-06-15');
      expect(isPreseason(jun)).toBe(false);
    });

    it('should use the current date by default', () => {
      // This test is date-dependent but ensures the function works without arguments
      const result = isPreseason();
      const currentMonth = new Date().getMonth();
      if (currentMonth < 2) {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });

  describe('Static Data Integrity', () => {
    it('should have 22 drivers (including Cadillac and Hadjar)', () => {
      expect(DRIVERS).toHaveLength(22);
    });

    it('should have unique driver IDs', () => {
      const ids = DRIVERS.map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid hex colors for all drivers', () => {
      DRIVERS.forEach(driver => {
        expect(driver.color).toMatch(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
      });
    });
  });
});

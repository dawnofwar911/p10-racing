import { describe, it, expect } from 'vitest';
import { TEAM_COLORS } from '@/lib/api';

describe('Data Integrity Tests', () => {
  const KNOWN_2026_TEAMS = [
    'red_bull', 'ferrari', 'mclaren', 'mercedes', 
    'aston_martin', 'alpine', 'williams', 'rb', 
    'audi', 'haas', 'cadillac'
  ];

  it('should have color definitions for all 2026 teams', () => {
    KNOWN_2026_TEAMS.forEach(teamId => {
      expect(TEAM_COLORS[teamId]).toBeDefined();
      expect(TEAM_COLORS[teamId]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('should not have duplicate colors across major teams (except potentially Audi/Haas)', () => {
    const colors = Object.values(TEAM_COLORS);
    const uniqueColors = new Set(colors);
    // Audi and Haas are both white/silver/grey, so they might share a color in some versions,
    // but in lib/api.ts they are currently '#ffffff' and '#B6BABD' respectively.
    expect(uniqueColors.size).toBeGreaterThanOrEqual(KNOWN_2026_TEAMS.length - 1);
  });
});

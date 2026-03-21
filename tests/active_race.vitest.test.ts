import { describe, it, expect } from 'vitest';
import { getActiveRaceIndex } from '@/lib/utils/races';

describe('Active Race Logic Tests', () => {
  const races = [
    { round: '1', date: '2026-03-01', time: '10:00:00Z', raceName: 'Bahrain', Circuit: { circuitName: 'Sakhir' }, season: '2026' },
    { round: '2', date: '2026-03-15', time: '05:00:00Z', raceName: 'Australia', Circuit: { circuitName: 'Albert Park' }, season: '2026' },
    { round: '3', date: '2026-04-05', time: '05:00:00Z', raceName: 'Japan', Circuit: { circuitName: 'Suzuka' }, season: '2026' }
  ];

  it('should target the next race in the future', () => {
    const now = new Date('2026-03-10T10:00:00Z');
    // Previous race (Round 1) has results
    const resultsMap = { '1': { positions: {}, firstDnf: null, date: new Date('2026-03-01T10:00:00Z') } };
    const { index } = getActiveRaceIndex(races as any, resultsMap as any, now);
    expect(index).toBe(1); // Australia
  });

  it('should stay on the current race if it just started (within 4h) and no results published', () => {
    // 1 hour after Australia start
    const now = new Date('2026-03-15T06:00:00Z'); 
    const resultsMap = { '1': { positions: {}, firstDnf: null, date: new Date('2026-03-01T10:00:00Z') } };
    const { index } = getActiveRaceIndex(races as any, resultsMap as any, now);
    expect(index).toBe(1); // Stay on Australia
  });

  it('should move to the next race once current results are available (even if within 4h)', () => {
    // 1 hour after Australia start, but results are in!
    const now = new Date('2026-03-15T06:00:00Z');
    const resultsMap = { 
      '1': { positions: {}, firstDnf: null, date: new Date('2026-03-01T10:00:00Z') },
      '2': { positions: {}, firstDnf: null, date: new Date('2026-03-15T05:00:00Z') } 
    };
    const { index } = getActiveRaceIndex(races as any, resultsMap as any, now);
    expect(index).toBe(2); // Move to Japan early (SMART UNLOCK)
  });

  it('should identify when the season is finished', () => {
    const now = new Date('2026-04-10T10:00:00Z'); // Past the last race
    const resultsMap = { 
      '1': { positions: {}, firstDnf: null, date: new Date('2026-03-01T10:00:00Z') },
      '2': { positions: {}, firstDnf: null, date: new Date('2026-03-15T05:00:00Z') },
      '3': { positions: {}, firstDnf: null, date: new Date('2026-04-05T05:00:00Z') } 
    };
    const { index, isSeasonFinished } = getActiveRaceIndex(races as any, resultsMap as any, now);
    expect(index).toBe(2); // Last race
    expect(isSeasonFinished).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';

/**
 * Logic extracted from PredictPage to find the "active" index.
 */
function getActiveRaceIndex(now: Date, races: any[], fetchResults: (round: number) => any): number {
  // Find first race in the future
  let activeIndex = races.findIndex(r => {
    const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
    return raceTime > now;
  });

  if (activeIndex === -1) activeIndex = races.length - 1;

  // Check if the previous race (the one that just happened) has results
  if (activeIndex > 0) {
    const prevRace = races[activeIndex - 1];
    const results = fetchResults(parseInt(prevRace.round));
    if (!results) {
      // No results yet! Keep showing the race that just happened
      return activeIndex - 1;
    }
  }

  return activeIndex;
}

describe('Active Race Logic Tests', () => {
  const races = [
    { round: '1', date: '2026-03-01', time: '10:00:00Z', raceName: 'Bahrain' },
    { round: '2', date: '2026-03-15', time: '05:00:00Z', raceName: 'Australia' },
    { round: '3', date: '2026-04-05', time: '05:00:00Z', raceName: 'Japan' }
  ];

  it('should target the next race in the future', () => {
    const now = new Date('2026-03-10T10:00:00Z');
    const idx = getActiveRaceIndex(now, races, (r) => (r === 1 ? { Results: [] } : null));
    expect(idx).toBe(1); // Australia
  });

  it('should stay on the current race if no results are published yet', () => {
    const now = new Date('2026-03-15T08:00:00Z'); 
    const idx = getActiveRaceIndex(now, races, (r) => {
      if (r === 1) return { Results: [] }; 
      if (r === 2) return null; 
      return null;
    });
    expect(idx).toBe(1); // Stay on Australia
  });

  it('should move to the next race once current results are available', () => {
    const now = new Date('2026-03-15T12:00:00Z');
    const idx = getActiveRaceIndex(now, races, (r) => {
      if (r === 1) return { Results: [] };
      if (r === 2) return { Results: [] }; 
      return null;
    });
    expect(idx).toBe(2); // Move to Japan
  });
});

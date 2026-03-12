import { describe, it, expect } from 'vitest';

function isPredictionLocked(now: Date, raceDate: string, raceTime: string): boolean {
  const raceStartTime = new Date(`${raceDate}T${raceTime}`);
  const lockTime = new Date(raceStartTime.getTime() + 120000); // 2 minutes after start
  return now > lockTime;
}

describe('Prediction Locking Logic', () => {
  it('should NOT be locked 1 day before the race', () => {
    const now = new Date('2026-03-14T10:00:00Z');
    const locked = isPredictionLocked(now, '2026-03-15', '05:00:00Z');
    expect(locked).toBe(false);
  });

  it('should NOT be locked exactly at start time', () => {
    const now = new Date('2026-03-15T05:00:00Z');
    const locked = isPredictionLocked(now, '2026-03-15', '05:00:00Z');
    expect(locked).toBe(false);
  });

  it('should NOT be locked 1 minute after start time', () => {
    const now = new Date('2026-03-15T05:01:00Z');
    const locked = isPredictionLocked(now, '2026-03-15', '05:00:00Z');
    expect(locked).toBe(false);
  });

  it('should be locked 2 minutes and 1 second after start time', () => {
    const now = new Date('2026-03-15T05:02:01Z');
    const locked = isPredictionLocked(now, '2026-03-15', '05:00:00Z');
    expect(locked).toBe(true);
  });
});

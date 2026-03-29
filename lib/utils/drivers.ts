import { Driver } from '@/lib/types';

/**
 * Shared utility to determine if a status string or telemetry state indicates 
 * a true DNF (Retired during race). Excludes DNS (Did not start) and 
 * other non-participation statuses.
 * 
 * Uses robust string casting to prevent crashes if status is null or not a string.
 */
export function isTrueDnf(status: unknown, laps: string | number = "1"): boolean {
  const s = String(status || '').toLowerCase();
  const isFinished = s === "finished" || s.includes("lap");
  const isDns = s.includes("not start") || s === "dns" || s.includes("qualify") || s.includes("withdrawn");
  const lapCount = typeof laps === 'string' ? parseInt(laps) : laps;
  const hasLaps = lapCount > 0;
  
  return !isFinished && !isDns && hasLaps;
}

/**
 * Extracts a concise display name for a driver (usually the last name or code).
 */
export const getDriverDisplayName = (driverId: string, allDrivers: Driver[]): string => {
  const driver = allDrivers.find(d => d.id === driverId);
  if (driver?.name) {
    return driver.name.split(' ').pop() || '';
  }
  // Fallback to the ID part if name not found
  return driverId?.split('_').pop()?.toUpperCase() || '';
};

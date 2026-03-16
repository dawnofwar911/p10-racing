import { ApiCalendarRace } from '../api';
import { EnhancedSimplifiedResults } from '../results';

/**
 * Determines the current active race index based on time and result availability.
 */
export function getActiveRaceIndex(
  races: ApiCalendarRace[], 
  raceResultsMap: { [round: string]: EnhancedSimplifiedResults },
  now: Date = new Date()
): { index: number; isSeasonFinished: boolean } {
  if (races.length === 0) return { index: -1, isSeasonFinished: false };

  // 1. Find the first race that hasn't finished + 4 hours
  let activeIndex = races.findIndex((r) => {
    const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
    const fourHoursLater = new Date(raceTime.getTime() + 4 * 60 * 60 * 1000);
    return fourHoursLater > now;
  });

  // 2. Fallback to last race if none found (season might be finished)
  if (activeIndex === -1) {
    activeIndex = races.length - 1;
  }

  // 3. SMART UNLOCK: If the identified "active" race already has results, advance early.
  const currentCandidate = races[activeIndex];
  if (raceResultsMap[currentCandidate.round]) {
    if (activeIndex < races.length - 1) {
      activeIndex++;
    } else {
      // If we're at the last race and it has results, the season is finished.
      const resultsFoundCount = Object.keys(raceResultsMap).length;
      if (resultsFoundCount === races.length) {
        return { index: activeIndex, isSeasonFinished: true };
      }
    }
  }

  // Final season finished check based on time vs last race
  const lastRace = races[races.length - 1];
  const lastRaceTime = new Date(`${lastRace.date}T${lastRace.time || '00:00:00Z'}`);
  const lastRaceFinished = new Date(lastRaceTime.getTime() + 4 * 60 * 60 * 1000) <= now;
  const isSeasonFinished = activeIndex === races.length - 1 && lastRaceFinished && !!raceResultsMap[lastRace.round];

  return { index: activeIndex, isSeasonFinished };
}

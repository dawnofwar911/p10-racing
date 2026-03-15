import { createClient } from './supabase/client';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver, ApiCalendarRace } from './api';
import { CURRENT_SEASON, SimplifiedResults } from './data';

export interface EnhancedSimplifiedResults extends SimplifiedResults {
  date: Date;
}

/**
 * Fetches all race results for the current season, prioritizing Supabase verified_results
 * (The Gold Standard). If not available, it falls back to API fetching and LocalStorage caching.
 */
export async function fetchAllSimplifiedResults(): Promise<{ [round: string]: EnhancedSimplifiedResults }> {
  const supabase = createClient();
  const races = await fetchCalendar(CURRENT_SEASON);
  const raceResultsMap: { [round: string]: EnhancedSimplifiedResults } = {};
  
  // 1. Fetch all "Gold Standard" verified results from Supabase
  const { data: verifiedData } = await supabase.from('verified_results').select('*');
  
  await Promise.all(races.map(async (race: ApiCalendarRace) => {
    const round = race.round;
    const raceDate = new Date(`${race.date}T${race.time || '00:00:00Z'}`);
    const verifiedMatch = verifiedData?.find(v => v.id === `${CURRENT_SEASON}_${round}`);
    
    if (verifiedMatch) {
      // Priority 1: Supabase Verified Results
      raceResultsMap[round] = { ...(verifiedMatch.data as SimplifiedResults), date: raceDate };
    } else {
      // Priority 2: localStorage (Cached results from previous API fetches)
      const cachedData = localStorage.getItem(`results_${CURRENT_SEASON}_${round}`);
      if (cachedData) {
        raceResultsMap[round] = { ...JSON.parse(cachedData), date: raceDate };
      } else {
        // Priority 3: Direct API fetch (Live fallback)
        const apiResults = await fetchRaceResults(CURRENT_SEASON, parseInt(round));
        if (apiResults && apiResults.Results && apiResults.Results.length > 0) {
          const firstDnfDriver = getFirstDnfDriver(apiResults);
          const simplified: SimplifiedResults = {
            positions: apiResults.Results.reduce((acc: { [key: string]: number }, r) => {
              acc[r.Driver.driverId] = parseInt(r.position);
              return acc;
            }, {}),
            firstDnf: firstDnfDriver ? firstDnfDriver.driverId : null
          };
          
          raceResultsMap[round] = { ...simplified, date: raceDate };
          
          // Cache for performance and offline support
          localStorage.setItem(`results_${CURRENT_SEASON}_${round}`, JSON.stringify(simplified));
        }
      }
    }
  }));

  return raceResultsMap;
}

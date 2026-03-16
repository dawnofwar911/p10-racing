import { createServerClient } from './supabase/client';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver, getP10DriverId } from './api';
import { CURRENT_SEASON } from './data';
import { SimplifiedResults } from './types';
import { storage } from './storage';

export type EnhancedSimplifiedResults = SimplifiedResults & { date: Date };

/**
 * Fetches all verified results for the given season.
 * It prioritizes the official `verified_results` table in Supabase 
 * (The Gold Standard). If not available, it falls back to API fetching and LocalStorage caching.
 */
export async function fetchAllSimplifiedResults(season: number = CURRENT_SEASON): Promise<{ [round: string]: EnhancedSimplifiedResults }> {
  const supabase = createServerClient();
  const resultsMap: { [round: string]: EnhancedSimplifiedResults } = {};
  
  // To avoid window is not defined errors in SSR
  const isClient = typeof window !== 'undefined';

  // 0. Fetch calendar at the start to ensure we have dates for all rounds
  const races = await fetchCalendar(season);
  const raceDates = new Map<string, Date>(
    races.map(r => [r.round, new Date(`${r.date}T${r.time || '00:00:00Z'}`)])
  );

  try {
    // Priority 1: Supabase Verified Results
    // Schema uses "id" as "season_round" (e.g., "2026_1") and "data" as JSONB
    const { data: verifiedData, error: verifiedError } = await supabase
      .from('verified_results')
      .select('*')
      .like('id', `${season}_%`);
      
    if (!verifiedError && verifiedData && verifiedData.length > 0) {
      // We have official results!
      for (const row of verifiedData) {
        const round = row.id.split('_')[1];
        const data = row.data as { positions: { [driverId: string]: number }, firstDnf: string | null };
        const raceDate = raceDates.get(round) || new Date(row.created_at);
        
        resultsMap[round] = {
          firstDnf: data.firstDnf || null,
          positions: data.positions,
          date: raceDate
        };
        
        // Cache these verified results locally for fast offline access
        if (isClient) {
          await storage.setItem(`results_${season}_${round}`, JSON.stringify(resultsMap[round]));
        }
      }
      return resultsMap;
    }
  } catch (e) {
    console.error('Error fetching verified results from Supabase:', e);
  }

  // FALLBACK STRATEGY (If Supabase fails or is empty for this season)
  console.log(`Falling back to API/Cache for season ${season} results...`);
  
  for (let round = 1; round <= 25; round++) {
    const roundStr = round.toString();
    try {
      // Priority 2: Cache (Cached results from previous API fetches)
      const cachedData = isClient ? await storage.getItem(`results_${season}_${roundStr}`) : null;
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        // Ensure the date is correctly re-hydrated if it was stored as string
        resultsMap[roundStr] = {
          ...parsed,
          date: new Date(parsed.date || raceDates.get(roundStr) || new Date())
        };
        continue; // Go to next round
      }

      // Priority 3: Ergast API Fetch
      const raceData = await fetchRaceResults(season, round);
      if (raceData && raceData.Results && raceData.Results.length > 0) {
        const dnfDriver = getFirstDnfDriver(raceData);
        const p10DriverId = getP10DriverId(raceData);
        
        const positions: { [driverId: string]: number } = {};
        raceData.Results.forEach((r: { Driver: { driverId: string }, position: string }) => {
          positions[r.Driver.driverId] = parseInt(r.position);
        });

        if (p10DriverId) {
          const raceDate = raceDates.get(roundStr) || new Date();
          const simplified: EnhancedSimplifiedResults = {
            firstDnf: dnfDriver ? dnfDriver.driverId : null,
            positions,
            date: raceDate
          };
          resultsMap[roundStr] = simplified;
          
          if (isClient) {
            await storage.setItem(`results_${season}_${roundStr}`, JSON.stringify(simplified));
          }
        }
      } else {
        // If we hit a round with no results, the season (so far) is over
        break; 
      }
    } catch (e) {
      console.error(`Failed to fetch fallback results for round ${round}:`, e);
      break;
    }
  }

  return resultsMap;
}

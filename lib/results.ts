import { createServerClient } from './supabase/client';
import { fetchRaceResults, getFirstDnfDriver, getP10DriverId } from './api';
import { CURRENT_SEASON } from './data';
import { SimplifiedResults } from './types';
import { storage } from './storage';

export type EnhancedSimplifiedResults = SimplifiedResults & { date?: Date };

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

  try {
    // Priority 1: Supabase Verified Results
    const { data: verifiedData, error: verifiedError } = await supabase
      .from('verified_results')
      .select('*')
      .eq('season', season);
      
    if (!verifiedError && verifiedData && verifiedData.length > 0) {
      // We have official results!
      verifiedData.forEach(row => {
        resultsMap[row.round.toString()] = {
          firstDnf: row.dnf_driver_id || null,
          positions: row.positions as { [driverId: string]: number },
          date: new Date(row.created_at) // Approximate race date based on entry creation
        };
        
        // Cache these verified results locally for fast offline access
        if (isClient) {
          storage.setItem(`results_${season}_${row.round}`, JSON.stringify(resultsMap[row.round.toString()]));
        }
      });
      return resultsMap;
    }
  } catch (e) {
    console.error('Error fetching verified results from Supabase:', e);
  }

  // FALLBACK STRATEGY (If Supabase fails or is empty for this season)
  console.log(`Falling back to API/Cache for season ${season} results...`);
  
  // We don't know exactly how many races there are, so we check up to a reasonable max (e.g., 25)
  // But we stop as soon as we hit an unrun race.
  for (let round = 1; round <= 25; round++) {
    try {
      // Priority 2: Cache (Cached results from previous API fetches)
      const cachedData = isClient ? await storage.getItem(`results_${season}_${round}`) : null;
      if (cachedData) {
        resultsMap[round.toString()] = JSON.parse(cachedData);
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
          const simplified: SimplifiedResults = {
            firstDnf: dnfDriver ? dnfDriver.driverId : null,
            positions
          };
          resultsMap[round.toString()] = simplified;
          
          if (isClient) {
            await storage.setItem(`results_${season}_${round}`, JSON.stringify(simplified));
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

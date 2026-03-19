/**
 * Centralized localStorage keys and helper functions to avoid magic strings
 * and ensure consistency across the application.
 */

export const STORAGE_KEYS = {
  CURRENT_USER: 'p10_current_user',
  CACHE_USERNAME: 'p10_cache_username',
  PLAYERS_LIST: 'p10_players', // Restored from old version
  CACHE_NEXT_RACE: 'p10_cache_next_race',
  CACHE_DRIVERS: 'p10_cache_drivers',
  CACHE_STANDINGS: 'p10_cache_standings',
  CACHE_LEADERBOARD: 'p10_cache_leaderboard',
  CACHE_LEAGUES: 'p10_cache_leagues',
  IS_ADMIN: 'p10_is_admin',
  SYNC_QUEUE: 'p10_sync_queue',
  HAPTICS_ENABLED: 'p10_haptics_enabled',
  HAS_SESSION: 'p10_has_session',
} as const;

export const STORAGE_UPDATE_EVENT = 'p10:storage_update'; // Restored from old version

/**
 * Custom wrapper for localStorage.setItem that dispatches a global update event.
 */
export function setStorageItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, { detail: { key, value } })); // Restored value in detail
}

/**
 * Custom wrapper for localStorage.removeItem that dispatches a global update event.
 */
export function removeStorageItem(key: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, { detail: { key } }));
}

export function getPredictionKey(season: number | string, userId: string, raceId: string | number): string {
  return `final_pred_${season}_${userId}_${raceId}`;
}

export function getGridKey(round: string | number): string {
  return `p10_cache_grid_${round}`;
}

export function getCommunityKey(round: string | number): string {
  return `p10_cache_community_${round}`;
}

export function getResultsKey(season: number | string, round: string | number): string {
  return `results_${season}_${round}`;
}

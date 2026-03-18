/**
 * Centralized localStorage keys and helper functions to avoid magic strings
 * and ensure consistency across the application.
 */

export const STORAGE_KEYS = {
  CURRENT_USER: 'p10_current_user',
  CACHE_USERNAME: 'p10_cache_username',
  CACHE_NEXT_RACE: 'p10_cache_next_race',
  CACHE_DRIVERS: 'p10_cache_drivers',
  CACHE_LEADERBOARD: 'p10_cache_leaderboard',
  CACHE_LEAGUES: 'p10_cache_leagues',
  CACHE_STANDINGS: 'p10_cache_standings',
  HAS_SESSION: 'p10_has_session',
  IS_ADMIN: 'p10_is_admin', // Standardized from p10_cache_is_admin
  PLAYERS_LIST: 'p10_players',
  SYNC_QUEUE: 'p10_sync_queue',
} as const;

export const STORAGE_UPDATE_EVENT = 'p10:storage_update';

/**
 * Returns the localStorage key for a specific prediction.
 */
export function getPredictionKey(season: number | string, userId: string, raceId: string | number): string {
  return `final_pred_${season}_${userId}_${raceId}`;
}

/**
 * Returns the localStorage key for a specific race grid.
 */
export function getGridKey(round: string | number): string {
  return `p10_cache_grid_${round}`;
}

/**
 * Returns the localStorage key for community predictions of a specific race.
 */
export function getCommunityKey(round: string | number): string {
  return `p10_cache_community_${round}`;
}

/**
 * Returns the localStorage key for race results.
 */
export function getResultsKey(season: number | string, round: string | number): string {
  return `results_${season}_${round}`;
}

/**
 * Helper to set localStorage and dispatch a global update event.
 */
export function setStorageItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, { detail: { key, value } }));
}

/**
 * Helper to remove localStorage and dispatch a global update event.
 */
export function removeStorageItem(key: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, { detail: { key } }));
}

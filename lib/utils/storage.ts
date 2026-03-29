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
  CACHE_CONSTRUCTORS: 'p10_cache_constructors',
  CACHE_LEADERBOARD: 'p10_cache_leaderboard',
  CACHE_LOCAL_LEADERBOARD: 'p10_cache_local_leaderboard',
  CACHE_LEAGUES: 'p10_cache_leagues',
  CACHE_CALENDAR: 'p10_cache_calendar',
  CACHE_DRIVER_FORM: 'p10_cache_driver_form',
  CACHE_ACHIEVEMENTS: 'p10_cache_achievements',
  IS_ADMIN: 'p10_is_admin',
  SYNC_QUEUE: 'p10_sync_queue',
  HAPTICS_ENABLED: 'p10_haptics_enabled',
  SHAKE_TO_REPORT_ENABLED: 'p10_shake_to_report_enabled',
  USE_TEAM_THEME: 'p10_use_team_theme',
  HAS_SESSION: 'p10_has_session',
  CACHE_PWA_HINT_DISMISSED: 'p10_pwa_hint_dismissed',
  PRED_PREFIX: 'final_pred_',
  GRID_PREFIX: 'p10_cache_grid_',
  COMMUNITY_PREFIX: 'p10_cache_community_',
  RESULTS_PREFIX: 'results_',
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
  return `${STORAGE_KEYS.PRED_PREFIX}${season}_${userId}_${raceId}`;
}

export function getGridKey(round: string | number): string {
  return `${STORAGE_KEYS.GRID_PREFIX}${round}`;
}

export function getCommunityKey(round: string | number): string {
  return `${STORAGE_KEYS.COMMUNITY_PREFIX}${round}`;
}

export function getResultsKey(season: number | string, round: string | number): string {
  return `${STORAGE_KEYS.RESULTS_PREFIX}${season}_${round}`;
}

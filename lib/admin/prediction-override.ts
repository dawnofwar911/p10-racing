import type { SupabaseClient } from '@supabase/supabase-js';

export interface PredictionOverrideInput {
  userId: string;
  season: number;
  round: string;
  p10DriverId: string;
  dnfDriverId: string;
}

export interface PlayerOption {
  id: string;
  username: string;
}

export function buildRaceId(season: number, round: string): string {
  return `${season}_${round}`;
}

export function validateOverride(input: PredictionOverrideInput): string | null {
  if (!input.userId) return 'Pick a player';
  if (!input.round) return 'Pick a race';
  if (!input.p10DriverId) return 'Pick a P10 driver';
  if (!input.dnfDriverId) return 'Pick a first DNF driver';
  return null;
}

/** Saves a player's prediction through the admin-only RPC, which bypasses the race lock. */
export async function saveOverride(supabase: SupabaseClient, input: PredictionOverrideInput) {
  const invalid = validateOverride(input);
  if (invalid) return { error: invalid };

  const { error } = await supabase.rpc('admin_upsert_prediction', {
    p_user_id: input.userId,
    p_race_id: buildRaceId(input.season, input.round),
    p_p10_driver_id: input.p10DriverId,
    p_dnf_driver_id: input.dnfDriverId,
  });
  return { error: error ? error.message : null };
}

/** Sorts players by username, case-insensitive, dropping rows with no username. */
export function sortPlayers(rows: { id: string; username: string | null }[]): PlayerOption[] {
  return rows
    .filter((r): r is PlayerOption => !!r.username)
    .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
}

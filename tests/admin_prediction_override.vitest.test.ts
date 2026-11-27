import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRaceId, validateOverride, saveOverride, sortPlayers } from '@/lib/admin/prediction-override';

const base = { userId: 'u1', season: 2026, round: '19', p10DriverId: 'gasly', dnfDriverId: 'stroll' };

describe('admin prediction override', () => {
  it('builds the race id as season_round', () => {
    expect(buildRaceId(2026, '19')).toBe('2026_19');
  });

  it('requires every field', () => {
    expect(validateOverride(base)).toBeNull();
    expect(validateOverride({ ...base, userId: '' })).toBe('Pick a player');
    expect(validateOverride({ ...base, round: '' })).toBe('Pick a race');
    expect(validateOverride({ ...base, p10DriverId: '' })).toBe('Pick a P10 driver');
    expect(validateOverride({ ...base, dnfDriverId: '' })).toBe('Pick a first DNF driver');
  });

  it('calls the admin RPC with the right payload', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const res = await saveOverride({ rpc } as unknown as SupabaseClient, base);
    expect(res.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith('admin_upsert_prediction', {
      p_user_id: 'u1',
      p_race_id: '2026_19',
      p_p10_driver_id: 'gasly',
      p_dnf_driver_id: 'stroll',
    });
  });

  it('does not call the RPC when invalid and surfaces RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'Admin only' } });
    const client = { rpc } as unknown as SupabaseClient;
    expect((await saveOverride(client, { ...base, userId: '' })).error).toBe('Pick a player');
    expect(rpc).not.toHaveBeenCalled();
    expect((await saveOverride(client, base)).error).toBe('Admin only');
  });

  it('sorts players and drops blank usernames', () => {
    expect(sortPlayers([
      { id: '2', username: 'zed' },
      { id: '3', username: null },
      { id: '1', username: 'Itsonlyme' },
    ])).toEqual([{ id: '1', username: 'Itsonlyme' }, { id: '2', username: 'zed' }]);
  });
});

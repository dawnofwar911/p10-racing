import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGuestMigration } from '@/lib/hooks/use-guest-migration';
import { useAuth } from '@/components/AuthProvider';
import { getPredictionKey, STORAGE_KEYS } from '@/lib/utils/storage';
import { CURRENT_SEASON } from '@/lib/data';

// Mock dependencies
vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/utils/haptics', () => ({
  triggerHeavyHaptic: vi.fn(),
  triggerSuccessHaptic: vi.fn(),
}));

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  upsert: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

describe('useGuestMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should load local guests from localStorage', () => {
    const guests = ['Alice', 'Bob'];
    localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(guests));
    
    (useAuth as any).mockReturnValue({ session: null });

    const { result } = renderHook(() => useGuestMigration());

    expect(result.current.localGuests).toEqual(guests);
  });

  it('should not allow import when signed out', async () => {
    (useAuth as any).mockReturnValue({ session: null });

    const { result } = renderHook(() => useGuestMigration());

    await act(async () => {
      await result.current.importGuestData('Alice');
    });

    expect(result.current.error).toBe('You must be signed in to import data.');
    expect(mockSupabase.upsert).not.toHaveBeenCalled();
  });

  it('should successfully import guest predictions and cleanup', async () => {
    const userId = 'user-123';
    const guestName = 'Alice';
    const guests = [guestName, 'Bob'];
    
    localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(guests));
    
    // Set some predictions for Alice
    const pred1 = { p10: 'VER', dnf: 'SAR' };
    const pred2 = { p10: 'PER', dnf: 'LEC' };
    localStorage.setItem(getPredictionKey(CURRENT_SEASON, guestName, 1), JSON.stringify(pred1));
    localStorage.setItem(getPredictionKey(CURRENT_SEASON, guestName, 2), JSON.stringify(pred2));

    (useAuth as any).mockReturnValue({ session: { user: { id: userId } } });
    mockSupabase.upsert.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useGuestMigration());

    await act(async () => {
      await result.current.importGuestData(guestName);
    });

    // Verify upsert calls (one for each prediction)
    expect(mockSupabase.from).toHaveBeenCalledWith('predictions');
    expect(mockSupabase.upsert).toHaveBeenCalledTimes(2);
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        race_id: `${CURRENT_SEASON}_1`,
        p10_driver_id: 'VER',
        dnf_driver_id: 'SAR',
      }),
      expect.any(Object)
    );

    // Verify success state
    expect(result.current.success).toContain('Successfully imported 2 predictions');
    expect(result.current.error).toBeNull();

    // Verify cleanup
    const updatedGuests = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
    expect(updatedGuests).toEqual(['Bob']);
    expect(result.current.localGuests).toEqual(['Bob']);
    
    // Verify individual predictions removed
    expect(localStorage.getItem(getPredictionKey(CURRENT_SEASON, guestName, 1))).toBeNull();
    expect(localStorage.getItem(getPredictionKey(CURRENT_SEASON, guestName, 2))).toBeNull();
  });

  it('should handle errors during import', async () => {
    const userId = 'user-123';
    const guestName = 'Alice';
    localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify([guestName]));
    localStorage.setItem(getPredictionKey(CURRENT_SEASON, guestName, 1), JSON.stringify({ p10: 'VER', dnf: 'SAR' }));

    (useAuth as any).mockReturnValue({ session: { user: { id: userId } } });
    mockSupabase.upsert.mockResolvedValue({ error: { message: 'DB Error' } });

    const { result } = renderHook(() => useGuestMigration());

    await act(async () => {
      await result.current.importGuestData(guestName);
    });

    expect(result.current.error).toBe('Some predictions failed to import. Please try again.');
    expect(result.current.success).toBeNull();
    
    // Should NOT cleanup on error
    const guests = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
    expect(guests).toEqual([guestName]);
  });
});

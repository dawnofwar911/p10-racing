import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSyncPredictions } from '@/lib/hooks/use-sync-predictions';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { setStorageItem, getPredictionKey } from '@/lib/utils/storage';
import { CURRENT_SEASON } from '@/lib/data';

// Mock dependencies
vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/Notification', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock('@/lib/utils/haptics', () => ({
  triggerHeavyHaptic: vi.fn(),
}));

vi.mock('@/lib/utils/sync-queue', () => ({
  addToSyncQueue: vi.fn(),
}));

vi.mock('@/lib/utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/storage')>();
  return {
    ...actual,
    setStorageItem: vi.fn((key: string, value: string) => {
      localStorage.setItem(key, value);
    }),
  };
});

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

describe('useSyncPredictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should load guest predictions from local storage', async () => {
    const raceId = 'test-race-1';
    const guestName = 'GuestUser';
    const mockPred = { p10: 'driverA', dnf: 'driverB', username: guestName };
    
    // Set up local storage mock
    localStorage.setItem(getPredictionKey(CURRENT_SEASON, guestName, raceId), JSON.stringify(mockPred));

    // Mock auth as guest
    (useAuth as any).mockReturnValue({
      session: null,
      currentUser: guestName,
      displayName: guestName,
      syncVersion: 0,
    });

    const { result } = renderHook(() => useSyncPredictions(raceId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.prediction).toEqual({ p10: 'driverA', dnf: 'driverB', username: guestName });
    // Should not call DB for guests
    expect(mockSupabase.from).not.toHaveBeenCalledWith('predictions');
  });

  it('should fallback to DB for authenticated users if cache misses', async () => {
    const raceId = 'test-race-2';
    const userId = 'user-uuid-123';
    
    (useAuth as any).mockReturnValue({
      session: { user: { id: userId } },
      currentUser: 'AuthUser',
      displayName: 'AuthUser',
      syncVersion: 0,
    });

    // Mock DB response
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { p10_driver_id: 'driverX', dnf_driver_id: 'driverY' },
      error: null,
    });

    const { result } = renderHook(() => useSyncPredictions(raceId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('predictions');
    expect(result.current.prediction).toEqual({ p10: 'driverX', dnf: 'driverY' });
    
    // Should save back to local storage with UUID
    expect(setStorageItem).toHaveBeenCalledWith(
      getPredictionKey(CURRENT_SEASON, userId, raceId),
      expect.any(String)
    );
  });

  it('should use UUID for localStorage key when an authenticated user submits', async () => {
    const raceId = 'test-race-3';
    const userId = 'user-uuid-submit';
    
    (useAuth as any).mockReturnValue({
      session: { user: { id: userId } },
      currentUser: 'AuthUser',
      displayName: 'AuthUser',
      syncVersion: 0,
    });

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useSyncPredictions(raceId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Action
    const success = await result.current.submitPrediction('driverX', 'driverY');
    
    expect(success).toBe(true);
    expect(mockSupabase.upsert).toHaveBeenCalled();
    
    // Crucial bug fix check: Ensure it uses UUID, not displayName
    expect(setStorageItem).toHaveBeenCalledWith(
      getPredictionKey(CURRENT_SEASON, userId, raceId),
      expect.stringContaining('driverX')
    );
  });

  it('should queue prediction in SyncQueue if network fails', async () => {
    const { addToSyncQueue } = await import('@/lib/utils/sync-queue');
    const raceId = 'test-race-4';
    const userId = 'user-uuid-offline';
    
    (useAuth as any).mockReturnValue({
      session: { user: { id: userId } },
      currentUser: 'AuthUser',
      displayName: 'AuthUser',
      syncVersion: 0,
    });

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Mock network error
    mockSupabase.upsert.mockResolvedValueOnce({ 
      error: { message: 'Failed to fetch', code: '' } 
    });

    const { result } = renderHook(() => useSyncPredictions(raceId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Action
    let success = false;
    await act(async () => {
      success = await result.current.submitPrediction('driverX', 'driverY');
    });
    
    expect(success).toBe(true); // Should return true because it saved locally
    expect(addToSyncQueue).toHaveBeenCalled();
    
    await waitFor(() => {
      expect(result.current.prediction).toEqual({ p10: 'driverX', dnf: 'driverY' });
    });
  });
});

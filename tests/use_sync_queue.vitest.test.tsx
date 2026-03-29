import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSyncQueue } from '@/lib/hooks/use-sync-queue';
import { useAuth } from '@/components/AuthProvider';
import { flushSyncQueue, getSyncQueue } from '@/lib/utils/sync-queue';

// Mock dependencies
vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/Notification', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock('@/lib/utils/sync-queue', () => ({
  flushSyncQueue: vi.fn(),
  getSyncQueue: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

describe('useSyncQueue Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should flush the queue on mount if authenticated and queue is not empty', async () => {
    (useAuth as any).mockReturnValue({ session: { user: { id: 'user1' } } });
    (getSyncQueue as any).mockReturnValue({ '2026_1': {} });
    (flushSyncQueue as any).mockResolvedValue(1);

    renderHook(() => useSyncQueue());

    await waitFor(() => {
      expect(flushSyncQueue).toHaveBeenCalled();
    });
  });

  it('should not flush if no session exists', () => {
    (useAuth as any).mockReturnValue({ session: null });
    (getSyncQueue as any).mockReturnValue({ '2026_1': {} });

    renderHook(() => useSyncQueue());

    expect(flushSyncQueue).not.toHaveBeenCalled();
  });

  it('should not flush if queue is empty', () => {
    (useAuth as any).mockReturnValue({ session: { user: { id: 'user1' } } });
    (getSyncQueue as any).mockReturnValue({});

    renderHook(() => useSyncQueue());

    expect(flushSyncQueue).not.toHaveBeenCalled();
  });

  it('should trigger flush when app goes online', async () => {
    (useAuth as any).mockReturnValue({ session: { user: { id: 'user1' } } });
    (getSyncQueue as any).mockReturnValue({ '2026_1': {} });
    (flushSyncQueue as any).mockResolvedValue(1);

    renderHook(() => useSyncQueue());
    
    await waitFor(() => {
      expect(flushSyncQueue).toHaveBeenCalledTimes(1);
    });

    // Simulate online event
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(flushSyncQueue).toHaveBeenCalledTimes(2);
    });
  });
});

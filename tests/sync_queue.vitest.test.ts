import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSyncQueue, addToSyncQueue, removeFromSyncQueue, flushSyncQueue } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { http, HttpResponse } from 'msw';
import { server } from './setup';

// Mock Capacitor plugins
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
    schedule: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
  },
}));

describe('Sync Queue Logic Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should start with an empty queue', () => {
    const queue = getSyncQueue();
    expect(queue).toEqual({});
  });

  it('should add to the sync queue and persist to localStorage', async () => {
    const payload = {
      user_id: 'user1',
      race_id: '2026_1',
      p10_driver_id: 'verstappen',
      dnf_driver_id: 'perez',
      updated_at: new Date().toISOString()
    };

    await addToSyncQueue(payload);
    
    const queue = getSyncQueue();
    expect(queue['2026_1']).toEqual(payload);
    expect(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE)).toContain('verstappen');
  });

  it('should remove from the sync queue', async () => {
    const payload = {
      user_id: 'user1',
      race_id: '2026_1',
      p10_driver_id: 'verstappen',
      dnf_driver_id: 'perez',
      updated_at: new Date().toISOString()
    };

    await addToSyncQueue(payload);
    expect(getSyncQueue()['2026_1']).toBeDefined();

    await removeFromSyncQueue('2026_1');
    expect(getSyncQueue()['2026_1']).toBeUndefined();
  });

  it('should flush the queue to Supabase via MSW', async () => {
    const payload = {
      user_id: 'user1',
      race_id: '2026_1',
      p10_driver_id: 'verstappen',
      dnf_driver_id: 'perez',
      updated_at: new Date().toISOString()
    };

    await addToSyncQueue(payload);

    // Mock Supabase upsert
    server.use(
      http.post('*/rest/v1/predictions', () => {
        return new HttpResponse(null, { status: 201 });
      })
    );

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null })
    } as any;

    const onSuccess = vi.fn();
    const onLocked = vi.fn();

    const count = await flushSyncQueue(mockSupabase, onSuccess, onLocked);

    expect(count).toBe(1);
    expect(onSuccess).toHaveBeenCalledWith('2026_1');
    expect(getSyncQueue()).toEqual({});
  });

  it('should handle locked predictions during flush', async () => {
    const payload = {
      user_id: 'user1',
      race_id: '2026_1',
      p10_driver_id: 'verstappen',
      dnf_driver_id: 'perez',
      updated_at: new Date().toISOString()
    };

    await addToSyncQueue(payload);

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ 
        error: { message: 'Predictions are locked for this race' } 
      })
    } as any;

    const onSuccess = vi.fn();
    const onLocked = vi.fn();

    const count = await flushSyncQueue(mockSupabase, onSuccess, onLocked);

    expect(count).toBe(0);
    expect(onLocked).toHaveBeenCalledWith('2026_1');
    expect(getSyncQueue()).toEqual({}); // Should still remove from queue if locked
  });
});

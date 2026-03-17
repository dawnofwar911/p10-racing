import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import { createServerClient } from '@/lib/supabase/client';
import { 
  getSyncQueue, 
  addToSyncQueue, 
  removeFromSyncQueue, 
  flushSyncQueue, 
  SyncPayload 
} from '@/lib/utils/sync-queue';

// Mock environment variables for Supabase Client initialization
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

describe('Sync Queue Utility', () => {
  const supabase = createServerClient();
  const mockPayload: SyncPayload = {
    user_id: 'user-123',
    race_id: '2026_1',
    p10_driver_id: 'verstappen',
    dnf_driver_id: 'hamilton',
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should return an empty queue when localStorage is empty', () => {
    const queue = getSyncQueue();
    expect(queue).toEqual({});
  });

  it('should add a prediction to the queue', async () => {
    await addToSyncQueue(mockPayload);
    const queue = getSyncQueue();
    expect(queue['2026_1']).toEqual(mockPayload);
  });

  it('should overwrite existing prediction for the same race', async () => {
    await addToSyncQueue(mockPayload);
    const updatedPayload = { ...mockPayload, p10_driver_id: 'leclerc' };
    await addToSyncQueue(updatedPayload);
    
    const queue = getSyncQueue();
    expect(Object.keys(queue)).toHaveLength(1);
    expect(queue['2026_1'].p10_driver_id).toBe('leclerc');
  });

  it('should remove a prediction from the queue', async () => {
    await addToSyncQueue(mockPayload);
    await removeFromSyncQueue('2026_1');
    const queue = getSyncQueue();
    expect(queue['2026_1']).toBeUndefined();
  });

  it('should flush the sync queue successfully', async () => {
    // 1. Mock Supabase upsert success
    server.use(
      http.post('https://mock-project.supabase.co/rest/v1/predictions', () => {
        return new HttpResponse(null, { status: 201 });
      })
    );

    // 2. Add to queue
    await addToSyncQueue(mockPayload);
    
    // 3. Flush
    const onSuccess = vi.fn();
    const onLocked = vi.fn();
    const successCount = await flushSyncQueue(supabase, onSuccess, onLocked);

    // 4. Assertions
    expect(successCount).toBe(1);
    expect(onSuccess).toHaveBeenCalledWith('2026_1');
    expect(getSyncQueue()).toEqual({});
  });

  it('should handle locked predictions during flush', async () => {
    // 1. Mock Supabase upsert with "Predictions are locked" error
    server.use(
      http.post('https://mock-project.supabase.co/rest/v1/predictions', () => {
        return HttpResponse.json(
          { message: 'This race has already started. Predictions are locked.' },
          { status: 400 }
        );
      })
    );

    // 2. Add to queue
    await addToSyncQueue(mockPayload);
    
    // 3. Flush
    const onSuccess = vi.fn();
    const onLocked = vi.fn();
    const successCount = await flushSyncQueue(supabase, onSuccess, onLocked);

    // 4. Assertions
    expect(successCount).toBe(0);
    expect(onLocked).toHaveBeenCalledWith('2026_1');
    expect(getSyncQueue()).toEqual({}); // Should be removed from queue if locked
  });

  it('should NOT remove from queue if sync fails for other reasons', async () => {
    // 1. Mock Supabase upsert with generic error
    server.use(
      http.post('https://mock-project.supabase.co/rest/v1/predictions', () => {
        return HttpResponse.json(
          { message: 'Database unreachable' },
          { status: 500 }
        );
      })
    );

    // 2. Add to queue
    await addToSyncQueue(mockPayload);
    
    // 3. Flush
    const onSuccess = vi.fn();
    const onLocked = vi.fn();
    const successCount = await flushSyncQueue(supabase, onSuccess, onLocked);

    // 4. Assertions
    expect(successCount).toBe(0);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onLocked).not.toHaveBeenCalled();
    expect(getSyncQueue()['2026_1']).toBeDefined(); // Still in queue
  });
});

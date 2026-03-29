import { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_KEYS } from './storage';

export interface SyncPayload {
  user_id: string;
  race_id: string;
  p10_driver_id: string;
  dnf_driver_id: string;
  updated_at: string;
}

const QUEUE_KEY = STORAGE_KEYS.SYNC_QUEUE;
export const SYNC_COMPLETE_EVENT = 'p10:sync_complete';

/**
 * Atomic helper to get the current sync queue from localStorage.
 */
export function getSyncQueue(): Record<string, SyncPayload> {
  if (typeof window === 'undefined') return {};
  const queueRaw = localStorage.getItem(QUEUE_KEY);
  if (!queueRaw) return {};
  try {
    return JSON.parse(queueRaw);
  } catch (e) {
    console.error('Failed to parse sync queue', e);
    return {};
  }
}

/**
 * Atomic helper to save a prediction to the sync queue.
 */
export async function addToSyncQueue(payload: SyncPayload) {
  const queue = getSyncQueue();
  queue[payload.race_id] = payload;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const hasPermission = await LocalNotifications.checkPermissions();
    if (hasPermission.display === 'granted') {
      const notificationId = parseInt(payload.race_id.replace(/[^0-9]/g, '')) || Math.floor(Math.random() * 100000);
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Unsynced Prediction!',
            body: 'You have a pending offline prediction. Open P10 Racing while connected to the internet to sync it before the race!',
            id: notificationId,
            schedule: { at: new Date(Date.now() + 1000 * 60 * 15) }
          }
        ]
      });
    }
  } catch (err) {
    console.log('Local Notifications not available', err);
  }
}

/**
 * Atomic helper to remove from queue.
 */
export async function removeFromSyncQueue(raceId: string) {
  const queue = getSyncQueue();
  if (queue[raceId]) {
    delete queue[raceId];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const notificationId = parseInt(raceId.replace(/[^0-9]/g, '')) || Math.floor(Math.random() * 100000);
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch { /* ignore */ }
  }
}

/**
 * Atomic helper to process the entire queue.
 */
export async function flushSyncQueue(
  supabase: SupabaseClient, 
  onSuccess: (raceId: string) => void,
  onLocked: (raceId: string) => void
): Promise<number> {
  const queue = getSyncQueue();
  const raceIds = Object.keys(queue);
  if (raceIds.length === 0) return 0;

  let successCount = 0;
  for (const raceId of raceIds) {
    const payload = queue[raceId];
    const { error } = await supabase.from('predictions').upsert(payload, { onConflict: 'user_id, race_id' });
    
    if (!error) {
      await removeFromSyncQueue(raceId);
      successCount++;
      onSuccess(raceId);
    } else if (error.message.includes('Predictions are locked')) {
      await removeFromSyncQueue(raceId);
      onLocked(raceId);
    }
  }
  
  if (successCount > 0) {
    window.dispatchEvent(new CustomEvent(SYNC_COMPLETE_EVENT, { detail: { count: successCount } }));
  }
  
  return successCount;
}

/**
 * Dispatches a manual sync complete event.
 */
export function dispatchSyncComplete() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_COMPLETE_EVENT, { detail: { count: 0, manual: true } }));
  }
}

/**
 * Wraps a promise or thenable with a timeout.
 */
export async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs = 10000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(`Request timed out after ${timeoutMs}ms`);
      reject(new Error('Request timed out'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

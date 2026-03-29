'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useNotification } from '@/components/Notification';
import { flushSyncQueue, getSyncQueue } from '@/lib/utils/sync-queue';

/**
 * Global hook to handle background synchronization of offline predictions.
 * Runs on mount and whenever the app comes back online.
 */
export function useSyncQueue() {
  const supabase = createClient();
  const { session } = useAuth();
  const { showNotification } = useNotification();
  const syncInProgressRef = useRef(false);

  const performSync = useCallback(async () => {
    if (!session || syncInProgressRef.current) return;
    
    const queue = getSyncQueue();
    if (Object.keys(queue).length === 0) return;

    try {
      syncInProgressRef.current = true;
      console.log('SyncQueue: Starting background flush...');
      
      const count = await flushSyncQueue(
        supabase,
        (raceId) => {
          console.log(`SyncQueue: Successfully synced prediction for race ${raceId}`);
        },
        (raceId) => {
          showNotification(`Prediction for race ${raceId} was locked and could not be synced.`, 'warning');
        }
      );

      if (count > 0) {
        showNotification(`Successfully synced ${count} offline prediction(s)!`, 'success');
      }
    } catch (err) {
      console.error('SyncQueue: Flush error:', err);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [session, supabase, showNotification]);

  useEffect(() => {
    // 1. Flush on mount/auth change
    if (session) {
      performSync();
    }

    // 2. Flush when coming back online
    const handleOnline = () => {
      console.log('SyncQueue: Network restored, triggering sync...');
      performSync();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session, performSync]);

  return { triggerSync: performSync };
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { App } from '@capacitor/app';
import { createClient } from '@/lib/supabase/client';
import { useNotification } from '@/components/Notification';

export default function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const { showNotification } = useNotification();
  const supabase = createClient();
  const isSyncing = useRef(false);

  useEffect(() => {
    const flushSyncQueue = async () => {
      if (isSyncing.current || !navigator.onLine) return;
      
      const queueRaw = localStorage.getItem('p10_sync_queue');
      if (!queueRaw) return;
      
      try {
        const queue = JSON.parse(queueRaw);
        const races = Object.keys(queue);
        if (races.length === 0) return;

        isSyncing.current = true;
        let successCount = 0;

        for (const raceId of races) {
          const payload = queue[raceId];
          const { error } = await supabase.from('predictions').upsert(payload, { onConflict: 'user_id, race_id' });
          
          if (!error) {
            delete queue[raceId];
            successCount++;
            
            try {
              const { LocalNotifications } = await import('@capacitor/local-notifications');
              const notificationId = parseInt(raceId.replace(/[^0-9]/g, '')) || Math.floor(Math.random() * 100000);
              await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
            } catch {
              // Ignore if Local Notifications not available
            }
          } else if (error.message.includes('Predictions are locked')) {
            // If the race has already started, remove from queue and notify user
            delete queue[raceId];
            showNotification(`❌ Sync failed: Predictions for ${raceId} are already locked.`, 'error');
            
            try {
              const { LocalNotifications } = await import('@capacitor/local-notifications');
              const notificationId = parseInt(raceId.replace(/[^0-9]/g, '')) || Math.floor(Math.random() * 100000);
              await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
            } catch {
              // Ignore
            }
          }
        }
        
        if (Object.keys(queue).length > 0) {
          localStorage.setItem('p10_sync_queue', JSON.stringify(queue));
        } else {
          localStorage.removeItem('p10_sync_queue');
        }

        if (successCount > 0) {
          showNotification('✅ Offline predictions synced successfully!', 'success');
        }
      } catch (err) {
        console.error('Error flushing sync queue', err);
      } finally {
        isSyncing.current = false;
      }
    };

    function handleOnline() { 
      setIsOffline(false); 
      flushSyncQueue();
    }
    function handleOffline() { setIsOffline(true); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        flushSyncQueue();
      }
    });

    // Initial check
    if (!navigator.onLine) {
       setIsOffline(true);
    } else {
       flushSyncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      appStateListener.then(l => l.remove());
    };
  }, [supabase, showNotification]);

  return (
    <div className="offline-banner">
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pt-2">
              <Alert variant="danger" className="border-danger shadow-sm py-2 mb-0 text-center small fw-bold text-uppercase">
                ⚠️ No internet connection. Data may be stale.
              </Alert>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

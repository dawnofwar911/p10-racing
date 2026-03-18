'use client';

import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { App } from '@capacitor/app';
import { createClient } from '@/lib/supabase/client';
import { useNotification } from '@/components/Notification';
import { flushSyncQueue } from '@/lib/utils/sync-queue';

export default function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const { showNotification } = useNotification();
  const supabase = createClient();
  const isSyncing = useRef(false);

  useEffect(() => {
    const handleFlush = async () => {
      if (isSyncing.current || !navigator.onLine) return;
      isSyncing.current = true;
      
      try {
        const successCount = await flushSyncQueue(
          supabase,
          () => {}, // onSuccess individual
          (raceId) => {
            showNotification(`❌ Sync failed: Predictions for ${raceId} are already locked.`, 'error');
          }
        );

        if (successCount > 0) {
          showNotification('✅ Offline predictions synced successfully!', 'success');
          window.dispatchEvent(new CustomEvent('p10:sync_complete'));
        }
      } catch (err) {
        console.error('Error flushing sync queue', err);
      } finally {
        isSyncing.current = false;
      }
    };

    function handleOnline() { 
      setIsOffline(false); 
      handleFlush();
    }
    function handleOffline() { setIsOffline(true); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        handleFlush();
      }
    });

    // Initial check
    if (!navigator.onLine) {
       setIsOffline(true);
    } else {
       handleFlush();
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

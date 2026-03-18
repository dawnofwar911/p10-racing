'use client';

import { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { App } from '@capacitor/app';
import { APP_RESUME_EVENT } from '@/lib/utils/sync-queue';

export default function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function handleOnline() { setIsOffline(false); }
    function handleOffline() { setIsOffline(true); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('OfflineStatus: App foregrounded, dispatching APP_RESUME');
        window.dispatchEvent(new CustomEvent(APP_RESUME_EVENT));
      }
    });

    // Initial check
    if (!navigator.onLine) setIsOffline(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      appStateListener.then(l => l.remove());
    };
  }, []);

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

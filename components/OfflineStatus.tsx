'use client';

import { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function handleOnline() { setIsOffline(false); }
    function handleOffline() { setIsOffline(true); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) setIsOffline(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

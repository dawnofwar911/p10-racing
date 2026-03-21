'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BugReportModal from './BugReportModal';
import { triggerMediumHaptic } from '@/lib/utils/haptics';
import { STORAGE_KEYS } from '@/lib/utils/storage';

/**
 * Global component that listens for shake events and navigation changes
 * to facilitate easier bug reporting.
 */
export default function GlobalBugTrigger() {
  const [showModal, setShowModal] = useState(false);
  const pathname = usePathname();

  // Track the last non-settings URL for diagnostic context
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname !== '/settings') {
      window.__P10_LAST_URL__ = window.location.href;
    }
  }, [pathname]);

  useEffect(() => {
    const handleShake = () => {
      // Respect the user preference for shake to report
      const stored = localStorage.getItem(STORAGE_KEYS.SHAKE_TO_REPORT_ENABLED);
      if (stored === 'false') return;

      if (!showModal) {
        triggerMediumHaptic();
        setShowModal(true);
      }
    };

    window.addEventListener('p10:shake_detected', handleShake);
    return () => window.removeEventListener('p10:shake_detected', handleShake);
  }, [showModal]);

  return (
    <BugReportModal 
      show={showModal} 
      onHide={() => setShowModal(false)} 
    />
  );
}

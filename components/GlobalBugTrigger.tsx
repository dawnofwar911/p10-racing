'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BugReportModal from './BugReportModal';
import { triggerMediumHaptic } from '@/lib/utils/haptics';
import { STORAGE_KEYS, STORAGE_UPDATE_EVENT } from '@/lib/utils/storage';

/**
 * Global component that listens for shake events and navigation changes
 * to facilitate easier bug reporting.
 */
export default function GlobalBugTrigger() {
  const [showModal, setShowModal] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const pathname = usePathname();

  // Track user preference with synchronization
  useEffect(() => {
    const loadPreference = () => {
      const stored = localStorage.getItem(STORAGE_KEYS.SHAKE_TO_REPORT_ENABLED);
      setEnabled(stored !== 'false');
    };

    loadPreference();

    const handleStorageUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === STORAGE_KEYS.SHAKE_TO_REPORT_ENABLED) {
        setEnabled(detail.value !== 'false');
      }
    };

    window.addEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
    return () => window.removeEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
  }, []);

  // Track the last non-settings URL for diagnostic context
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname !== '/settings') {
      window.__P10_LAST_URL__ = window.location.href;
    }
  }, [pathname]);

  useEffect(() => {
    const handleShake = () => {
      if (!enabled) return;

      if (!showModal) {
        triggerMediumHaptic();
        setShowModal(true);
      }
    };

    window.addEventListener('p10:shake_detected', handleShake);
    return () => window.removeEventListener('p10:shake_detected', handleShake);
  }, [showModal, enabled]);

  return (
    <BugReportModal 
      show={showModal} 
      onHide={() => setShowModal(false)} 
    />
  );
}

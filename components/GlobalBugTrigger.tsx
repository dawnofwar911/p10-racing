'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BugReportModal from './BugReportModal';
import { triggerMediumHaptic } from '@/lib/utils/haptics';

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
      (window as any).__P10_LAST_URL__ = window.location.href;
    }
  }, [pathname]);

  useEffect(() => {
    const handleShake = () => {
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

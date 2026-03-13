'use client';

import React, { useState } from 'react';
import { Container } from 'react-bootstrap';
import Link from 'next/link';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import packageInfo from '../package.json';
import BugReportModal from './BugReportModal';

export default function AppFooter() {
  const [showBugReport, setShowBugReport] = useState(false);

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  return (
    <footer className="mt-auto py-4 border-top border-secondary border-opacity-10 text-center app-footer">
      <Container>
        <p className="text-white opacity-20 extra-small mb-1 fw-bold letter-spacing-1" style={{ fontSize: '0.6rem' }}>
          © 2026 P10 RACING • v{packageInfo.version}
        </p>
        <div className="d-flex justify-content-center gap-3">
          <Link 
            href="/privacy" 
            className="text-white extra-small text-decoration-none opacity-20 hover-opacity-100" 
            style={{ fontSize: '0.6rem' }} 
            onClick={triggerHaptic}
          >
            PRIVACY POLICY
          </Link>
          <span className="text-white opacity-10" style={{ fontSize: '0.6rem' }}>•</span>
          <button 
            onClick={() => { triggerHaptic(); setShowBugReport(true); }}
            className={`btn btn-link p-0 text-white extra-small text-decoration-none opacity-20 hover-opacity-100 fw-bold border-0`}
            style={{ fontSize: '0.6rem', background: 'none', boxShadow: 'none' }}
          >
            REPORT A BUG
          </button>
        </div>
      </Container>
      <BugReportModal show={showBugReport} onHide={() => setShowBugReport(false)} />
    </footer>
  );
}

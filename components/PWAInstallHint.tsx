'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { Share, X, PlusSquare } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import Image from 'next/image';
import HapticButton from './HapticButton';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import styles from './PWAInstallHint.module.css';

export default function PWAInstallHint() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    // 1. Never show in native apps
    if (Capacitor.isNativePlatform()) return;
    
    // 2. Check if already installed/standalone
    const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone || 
                         window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;
    
    // 3. Detect iOS Safari specifically
    const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);
    
    // 4. Don't show if user dismissed it in this session
    const dismissed = sessionStorage.getItem(STORAGE_KEYS.CACHE_PWA_HINT_DISMISSED);
    
    if (isIos && isSafari && !dismissed) {
      // Delay to avoid overwhelming
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem(STORAGE_KEYS.CACHE_PWA_HINT_DISMISSED, 'true');
  };

  if (!show) return null;

  return (
    <div className={`pwa-install-hint px-3 ${styles.container}`}>
      <Card 
        className={`f1-glass-card border-secondary border-opacity-50 mx-auto animate-slide-up ${styles.innerCard}`}
      >
        <Card.Body className="p-3">
          <Row className="align-items-center g-2">
            <Col xs="auto">
              <div 
                className={`bg-danger d-flex align-items-center justify-content-center rounded ${styles.logoWrapper}`}
              >
                <Image src="/logo.svg" alt="P10" width={24} height={24} />
              </div>
            </Col>
            <Col>
              <h6 className="mb-0 fw-bold">Install P10 Racing</h6>
              <p className="extra-small mb-0 opacity-75">Add to Home Screen for a faster, app-like experience.</p>
            </Col>
            <Col xs="auto">
              <HapticButton 
                variant="link" 
                className="text-white p-1 opacity-50" 
                onClick={dismiss}
              >
                <X size={20} />
              </HapticButton>
            </Col>
          </Row>
          <hr className="my-2 border-secondary opacity-25" />
          <div className="d-flex align-items-center justify-content-center gap-1 extra-small opacity-75">
            <span>Tap</span>
            <Share size={16} className="text-primary mx-1" />
            <span>then</span>
            <PlusSquare size={16} className="mx-1" />
            <span className="fw-bold">&quot;Add to Home Screen&quot;</span>
          </div>
        </Card.Body>
      </Card>
      
      {/* Arrow pointing to Safari share button (approximate location) */}
      <div 
        className={`text-primary mx-auto d-flex justify-content-center mt-2 ${styles.arrowWrapper}`}
      >
        <div className={styles.arrow}></div>
      </div>

      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}

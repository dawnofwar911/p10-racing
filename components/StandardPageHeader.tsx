'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import HapticButton from './HapticButton';

interface StandardPageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  icon: ReactNode;
  badge?: ReactNode;
  onBack?: () => void;
  rightElement?: ReactNode;
}

/**
 * A reusable F1-styled page header with a circular icon, title, optional subtitle,
 * badge, and back button.
 */
export default function StandardPageHeader({
  title,
  subtitle,
  icon,
  badge,
  onBack,
  rightElement
}: StandardPageHeaderProps) {
  const [headerShrunk, setHeaderShrunk] = useState(false);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const top = scrollContainer.scrollTop;
      
      // Simple hysteresis to prevent jitter
      if (!headerShrunk && top > 50) {
        setHeaderShrunk(true);
      } else if (headerShrunk && top < 10) {
        setHeaderShrunk(false);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [headerShrunk]);

  return (
    <div className={`sticky-header px-3 ${headerShrunk ? 'header-shrunk' : ''}`}>
      <div className="d-flex align-items-center w-100">
        <div className="d-flex align-items-center flex-grow-1 overflow-hidden">
          {onBack && (
            <HapticButton 
              variant="link" 
              className="text-white p-0 me-3 opacity-75 hover-opacity-100 border-0 d-flex align-items-center"
              onClick={onBack}
            >
              <ChevronLeft size={28} />
            </HapticButton>
          )}
          <div className="bg-danger rounded-3 header-icon-container me-3 shadow-sm">
            {icon}
          </div>
          <div className="overflow-hidden">
            <div className="d-flex align-items-center gap-2">
              <h1 className="h2 mb-0 f1-page-title text-white text-truncate">{title}</h1>
              {badge}
            </div>
            {subtitle && (
              <div className="text-muted text-uppercase fw-bold letter-spacing-1 header-subtitle text-truncate" style={{ fontSize: '0.65rem' }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {rightElement && (
          <div className="ms-3 flex-shrink-0">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

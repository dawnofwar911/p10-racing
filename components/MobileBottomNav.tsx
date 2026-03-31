'use client';

import React from 'react';
import HapticLink from './HapticLink';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, MAIN_SCROLL_CONTAINER_ID } from '@/lib/navigation';

export default function MobileBottomNav() {
  const pathname = usePathname();

  // On mobile, we show all navigation items.
  // The CSS 'd-xl-none' handles showing it only on mobile.
  return (
    <nav 
      className="d-xl-none mobile-bottom-nav border-top border-secondary border-opacity-25 shadow-lg"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        minHeight: 'var(--nav-height)'
      }}
    >
      <div className="d-flex justify-content-around align-items-center py-2 px-1" style={{ height: 'var(--nav-height)' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/' 
            ? pathname === '/' 
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <HapticLink 
              key={item.href}
              href={item.href}
              className="d-flex flex-column align-items-center text-decoration-none"
              style={{ flex: '1 1 0', minWidth: 0 }}
              onClick={() => {
                // If already on this page, scroll main container to top
                if (isActive) {
                  const scrollContainer = document.getElementById(MAIN_SCROLL_CONTAINER_ID);
                  if (scrollContainer) {
                    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }
              }}
            >
              <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                <Icon 
                  size={20} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-all"
                  style={{ color: isActive ? 'var(--team-accent)' : 'rgba(255,255,255,0.4)' }}
                />
              </div>
              <span 
                className="extra-small fw-bold text-uppercase letter-spacing-1 mt-1 transition-all"
                style={{ 
                  fontSize: '0.62rem', 
                  whiteSpace: 'nowrap',
                  color: isActive ? 'var(--team-accent)' : 'rgba(255,255,255,0.4)'
                }}
              >
                {item.label}
              </span>
            </HapticLink>
          );
        })}
      </div>
    </nav>
  );
}

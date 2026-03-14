'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { 
  Trophy, 
  Home, 
  Users, 
  LayoutGrid, 
  BarChart3 
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Predict', href: '/predict', icon: LayoutGrid },
  { label: 'Leagues', href: '/leagues', icon: Users },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { label: 'Standings', href: '/standings', icon: BarChart3 },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  // Only show on mobile, foldable, and tablet portrait (up to lg)
  return (
    <nav 
      className="d-lg-none mobile-bottom-nav border-top border-secondary border-opacity-25 shadow-lg"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        minHeight: 'var(--nav-height)'
      }}
    >
      <div className="d-flex justify-content-around align-items-center py-2" style={{ height: 'var(--nav-height)' }}>
        {navItems.map((item) => {
          const isActive = item.href === '/' 
            ? pathname === '/' 
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href}
              href={item.href}
              onClick={triggerHaptic}
              className="d-flex flex-column align-items-center text-decoration-none"
              style={{ flex: '1 1 0', minWidth: 0 }}
            >
              <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                <Icon 
                  size={20} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-all ${isActive ? 'text-danger' : 'text-white opacity-40'}`} 
                />
              </div>
              <span 
                className={`extra-small fw-bold text-uppercase letter-spacing-1 mt-1 transition-all ${isActive ? 'text-danger' : 'text-white opacity-40'}`}
                style={{ fontSize: '0.62rem', whiteSpace: 'nowrap' }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

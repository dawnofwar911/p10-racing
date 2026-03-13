'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { 
  Trophy, 
  Home, 
  Users, 
  History, 
  BarChart3 
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Leagues', href: '/leagues', icon: Users },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { label: 'Standings', href: '/standings', icon: BarChart3 },
  { label: 'History', href: '/history', icon: History },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  // Only show on mobile
  return (
    <nav 
      className="d-md-none fixed-bottom border-top border-secondary border-opacity-25 shadow-lg"
      style={{ 
        backgroundColor: '#15151e', 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 1030,
        height: 'calc(65px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      <div className="d-flex justify-content-around align-items-center h-100 py-2">
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

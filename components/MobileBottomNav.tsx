'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { 
  Trophy, 
  LayoutGrid, 
  Users, 
  History, 
  BarChart3 
} from 'lucide-react';

const navItems = [
  { label: 'Predict', href: '/predict', icon: LayoutGrid },
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
      className="d-md-none fixed-bottom border-top border-secondary border-opacity-25"
      style={{ 
        backgroundColor: '#15151e', 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 1030
      }}
    >
      <div className="d-flex justify-content-around align-items-center py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href}
              href={item.href}
              onClick={triggerHaptic}
              className="d-flex flex-column align-items-center text-decoration-none transition-all"
              style={{ width: '20%' }}
            >
              <Icon 
                size={20} 
                className={`mb-1 ${isActive ? 'text-danger' : 'text-white opacity-50'}`} 
              />
              <span 
                className={`extra-small fw-bold text-uppercase letter-spacing-1 ${isActive ? 'text-danger' : 'text-white opacity-50'}`}
                style={{ fontSize: '0.6rem' }}
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

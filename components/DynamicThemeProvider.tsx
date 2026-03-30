'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { getTeamPalette } from '@/lib/utils/colors';
import { STORAGE_KEYS, STORAGE_UPDATE_EVENT } from '@/lib/utils/storage';

/**
 * DynamicThemeProvider injected the user's favorite team colors into CSS variables.
 * This allows the entire app to be themed dynamically without passing props to every component.
 */
export default function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Initial load
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.USE_TEAM_THEME);
      setIsEnabled(stored !== 'false');
    }

    // Listen for changes in Settings
    const handleStorage = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string }>;
      if (customEvent.detail?.key === STORAGE_KEYS.USE_TEAM_THEME) {
        setIsEnabled(localStorage.getItem(STORAGE_KEYS.USE_TEAM_THEME) !== 'false');
      }
    };

    window.addEventListener(STORAGE_UPDATE_EVENT, handleStorage);
    return () => window.removeEventListener(STORAGE_UPDATE_EVENT, handleStorage);
  }, []);
  
  const palette = useMemo(() => {
    // Fallback to F1 Red if disabled or no profile
    const teamId = isEnabled ? profile?.favorite_team : null;
    return getTeamPalette(teamId);
  }, [profile?.favorite_team, isEnabled]);

  // Inject variables into a wrapper div that fills the viewport
  // We use inline styles for the variables so they update instantly when profile changes
  const themeStyles = {
    '--team-accent': palette.primary,
    '--team-accent-glow': palette.glow,
    '--team-accent-border': palette.border,
    '--team-accent-contrast': palette.contrast,
    transition: 'all 0.5s ease', // Smooth transition when changing teams
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  } as React.CSSProperties;

  return (
    <div style={themeStyles}>
      {children}
    </div>
  );
}

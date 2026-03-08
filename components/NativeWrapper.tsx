'use client';

import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export default function NativeWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function initNative() {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // 1. Configure the Status Bar to match our F1 dark theme
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#15151e' });
        
        // 2. Hide the splash screen once the app is initialized
        await SplashScreen.hide();
      } catch (err) {
        console.warn('Native initialization error:', err);
      }
    }
    initNative();
  }, []);

  return <>{children}</>;
}

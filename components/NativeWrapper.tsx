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
        // 1. Ensure the status bar does NOT overlap the webview
        // This pushes the webview down below the status bar automatically
        await StatusBar.setOverlaysWebView({ overlay: false });
        
        // 2. Configure the Status Bar style
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#15151e' });
        
        // 3. Hide the splash screen with a small delay to prevent flicker
        setTimeout(async () => {
          await SplashScreen.hide();
        }, 300);
      } catch (err) {
        console.warn('Native initialization error:', err);
      }
    }
    initNative();
  }, []);

  return <>{children}</>;
}

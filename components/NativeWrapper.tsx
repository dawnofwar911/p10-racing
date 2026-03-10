'use client';

import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

export default function NativeWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    async function initNative() {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // 1. Ensure the status bar does NOT overlap the webview
        await StatusBar.setOverlaysWebView({ overlay: false });
        
        // 2. Configure the Status Bar style
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#15151e' });
        
        // 3. Handle Deep Links
        App.addListener('appUrlOpen', (event) => {
          // Example: https://p10-racing.vercel.app/leagues?join=12345678
          const url = new URL(event.url);
          const path = url.pathname + url.search;
          router.push(path);
        });

        // 4. Hide the splash screen with a small delay to prevent flicker
        setTimeout(async () => {
          await SplashScreen.hide();
        }, 300);
      } catch (err) {
        console.warn('Native initialization error:', err);
      }
    }
    initNative();

    return () => {
      if (Capacitor.isNativePlatform()) {
        App.removeAllListeners();
      }
    };
  }, [router]);

  return <>{children}</>;
}

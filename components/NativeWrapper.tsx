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
        const handleDeepLink = (rawUrl: string) => {
          try {
            const url = new URL(rawUrl);
            let path = url.pathname;
            
            // Handle custom schemes like p10racing://leagues (where "leagues" might be the host)
            if (url.protocol === 'p10racing:') {
              path = url.host + url.pathname;
              if (!path.startsWith('/')) path = '/' + path;
            }
            
            const fullPath = path + url.search;
            console.log('Navigating to deep link:', fullPath);
            router.push(fullPath);
          } catch (err) {
            console.warn('Error parsing deep link URL:', err);
          }
        };

        App.addListener('appUrlOpen', (event) => {
          handleDeepLink(event.url);
        });

        // Handle URL that launched the app
        App.getLaunchUrl().then((launchUrl) => {
          if (launchUrl?.url) {
            handleDeepLink(launchUrl.url);
          }
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

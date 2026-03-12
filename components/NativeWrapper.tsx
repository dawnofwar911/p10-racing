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
        // 1. Ensure the status bar overlaps the webview so CSS safe-area-insets work
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
        
        // 2. We use Dark style because the app theme is dark (#15151e),
        // so we want light icons (white) on the status bar.
        // Style.Dark = Light text for dark backgrounds.
        await StatusBar.setStyle({ style: Style.Dark });
        
        // 2. Handle Deep Links
        const handleDeepLink = (rawUrl: string) => {
          try {
            console.log('Processing raw deep link:', rawUrl);
            const url = new URL(rawUrl);
            let path = url.pathname;
            
            // Handle custom schemes like p10racing:// (if used)
            if (url.protocol === 'p10racing:') {
              path = url.host + url.pathname;
            }
            
            // Ensure path starts with /
            if (!path.startsWith('/')) path = '/' + path;
            
            // Critical: Include search (query params like ?code=) and hash (#access_token=)
            const fullPath = path + url.search + url.hash;
            console.log('Navigating to full deep link path:', fullPath);
            
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

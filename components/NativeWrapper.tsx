'use client';

import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

export default function NativeWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    async function initNative() {
      if (!Capacitor.isNativePlatform()) return;

      try {
        const info = await Device.getInfo();
        const platform = info.platform;
        const osVersion = parseInt(info.osVersion || '0', 10);

        // 1. Ensure the status bar overlaps the webview so CSS safe-area-insets work
        // Note: Android 15+ (API 35+) enforces edge-to-edge by default.
        if (platform === 'android' && osVersion < 15) {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
        
        // 2. We use Dark style because the app theme is dark (#15151e),
        // so we want light icons (white) on the status bar.
        // Style.Dark = Light text for dark backgrounds.
        // On Android 15+, we skip this as it's handled by MainActivity.java's EdgeToEdge
        // to avoid deprecation warnings.
        if (platform !== 'android' || osVersion < 15) {
          await StatusBar.setStyle({ style: Style.Dark });
        }
        
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

        // 3. Handle Hardware Back Button (Android)
        App.addListener('backButton', ({ canGoBack }) => {
          const path = window.location.pathname;
          
          // Only exit the app if we are on the root home page
          if (path === '/') {
            App.exitApp();
          } else if (canGoBack) {
            // If we have history (e.g. went from Home -> Predict), go back
            router.back();
          } else {
            // If we are on a deep page but have no history (e.g. app launched to that page),
            // navigate to home instead of exiting
            router.push('/');
          }
        });

        // 4. Handle URL that launched the app
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

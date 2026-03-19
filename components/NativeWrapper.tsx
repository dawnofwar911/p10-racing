'use client';

import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

// Declare global for console logs
declare global {
  interface Window {
    __P10_ERROR_LOGS__: string[];
  }
}

export default function NativeWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Global console error interceptor
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    window.__P10_ERROR_LOGS__ = window.__P10_ERROR_LOGS__ || [];
    const originalError = console.error;

    // Safe stringify to avoid circular reference crashes
    const safeStringify = (obj: unknown): string => {
      try {
        if (typeof obj !== 'object' || obj === null) return String(obj);
        const cache = new Set();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
          }
          return value;
        });
      } catch {
        return '[Unstringifiable Object]';
      }
    };

    console.error = (...args: unknown[]) => {
      const message = args.map(arg => safeStringify(arg)).join(' ');
      window.__P10_ERROR_LOGS__ = [message, ...window.__P10_ERROR_LOGS__].slice(0, 10);
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  useEffect(() => {
    async function initNative() {
      if (!Capacitor.isNativePlatform()) return;

      try {
        const info = await Device.getInfo();
        const platform = info.platform;
        const osVersion = parseInt(info.osVersion || '0', 10);

        // Note: Android 15+ (API 35+) enforces edge-to-edge by default.
        // We avoid calling Capacitor StatusBar methods on Android 15+ to eliminate 
        // deprecation warnings for getStatusBarColor/setStatusBarColor/etc.
        if (platform === 'android' && osVersion < 15) {
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.setStyle({ style: Style.Dark });
        } else if (platform !== 'android') {
          // Keep normal behavior for iOS
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
        App.addListener('backButton', (data) => {
          // Check if any component wants to consume the back button
          // This is useful for closing drawers/modals before navigating
          const backEvent = new CustomEvent('backbutton', {
            cancelable: true,
            detail: data
          });
          window.dispatchEvent(backEvent);

          if (backEvent.defaultPrevented) {
            return;
          }

          const path = window.location.pathname;
          
          // Only exit the app if we are on the root home page
          if (path === '/') {
            App.exitApp();
          } else if (data.canGoBack) {
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

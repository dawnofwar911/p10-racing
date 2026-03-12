'use client';

import { useEffect } from 'react';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { createClient } from '@/lib/supabase/client';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    Capacitor?: unknown;
  }
}

export default function PushNotificationHandler() {
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    // Only run on mobile (Capacitor)
    if (typeof window === 'undefined' || !window.Capacitor) return;

    const setupPushNotifications = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('Push notification permission not granted');
          return;
        }

        await PushNotifications.register();

        // Listen for token registration
        PushNotifications.addListener('registration', async (token: Token) => {
          console.log('Push registration success, token: ' + token.value);
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            const deviceInfo = await Device.getInfo();
            await supabase.from('push_tokens').upsert({
              user_id: session.user.id,
              token: token.value,
              device_info: deviceInfo,
              created_at: new Date().toISOString()
            });
          }
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error: { error: string }) => {
          console.error('Push registration error: ' + JSON.stringify(error));
        });

        // Listen for incoming notifications
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ' + JSON.stringify(notification));
          // You could show a local alert or update UI state here
        });

        // Listen for notification clicks
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed: ' + JSON.stringify(notification));
          // Redirect to a specific page based on notification data
          const data = notification.notification.data;
          if (data && data.url) {
            window.location.href = data.url;
          }
        });

      } catch (err) {
        console.error('Error setting up push notifications:', err);
      }
    };

    setupPushNotifications();

    // Clean up listeners on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [supabase]);

  // Handle token update when user logs in/out
  useEffect(() => {
    const syncToken = async () => {
       if (typeof window === 'undefined' || !window.Capacitor) return;
       const { data: { session } } = await supabase.auth.getSession();
       if (session?.user) {
          // Trigger a re-registration to ensure we have the token and save it to the current user
          await PushNotifications.register();
       }
    };
    syncToken();
  }, [pathname, supabase]);

  return null;
}

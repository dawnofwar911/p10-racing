'use client';

import { useEffect } from 'react';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

declare global {
  interface Window {
    Capacitor?: unknown;
  }
}

export default function PushNotificationHandler() {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Only run on mobile (Capacitor)
    if (typeof window === 'undefined' || !window.Capacitor) return;

    const setupPushNotifications = async () => {
      try {
        // Clear any existing notifications from the tray when the app is opened
        if (Capacitor.isNativePlatform()) {
          await PushNotifications.removeAllDeliveredNotifications();
        }

        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('Push notification permission not granted');
          return;
        }

        // Also check/request local notifications permission
        const localPerms = await LocalNotifications.checkPermissions();
        if (localPerms.display === 'prompt') {
          await LocalNotifications.requestPermissions();
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
        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          console.log('Push notification received: ' + JSON.stringify(notification));
          
          // If the app is in the foreground, we need to show a local notification
          // to get a banner.
          await LocalNotifications.schedule({
            notifications: [
              {
                title: notification.title || 'P10 Racing',
                body: notification.body || '',
                id: Math.floor(Math.random() * 1000000),
                extra: notification.data,
                smallIcon: 'ic_stat_name', // Needs to match your resource name
                iconColor: '#e10600'
              }
            ]
          });
        });

        // Listen for local notification clicks (foreground)
        LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
           console.log('Local notification action performed', notification);
           const data = notification.notification.extra;
           if (data && data.url) {
             router.push(data.url);
           } else if (data && data.p_url) {
             router.push(data.p_url);
           }
        });

        // Listen for notification clicks
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed: ' + JSON.stringify(notification));
          // Redirect to a specific page based on notification data
          const data = notification.notification.data;
          if (data && data.url) {
            router.push(data.url);
          } else if (data && data.p_url) {
            router.push(data.p_url);
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
  }, [supabase, router]);

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

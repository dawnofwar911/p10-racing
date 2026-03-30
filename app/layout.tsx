import { Suspense } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import NativeWrapper from '@/components/NativeWrapper';
import PageTransition from '@/components/PageTransition';
import OfflineStatus from '@/components/OfflineStatus';
import AppNavbar from '@/components/AppNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import PushNotificationHandler from '@/components/PushNotificationHandler';
import PWAInstallHint from '@/components/PWAInstallHint';
import { NotificationProvider } from '@/components/Notification';
import { AuthProvider } from '@/components/AuthProvider';
import GlobalBugTrigger from '@/components/GlobalBugTrigger';

import DynamicThemeProvider from '@/components/DynamicThemeProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import ScrollReset from '@/components/ScrollReset';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'P10 Racing',
  description: 'F1 Midfield Prediction Game',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#15151e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-bs-theme="dark">
      <body className={inter.className}>
        <AuthProvider>
          <ScrollReset />
          <NotificationProvider>
            <ErrorBoundary>
              <NativeWrapper>
                <DynamicThemeProvider>
                  <PushNotificationHandler />
                  <AppNavbar />
                  <OfflineStatus />
                  
                  {/* THE PERMANENT SCROLL CONTAINER */}
                  <main id="main-scroll-container">
                    <Suspense fallback={null}>
                      <PageTransition>
                        {children}
                      </PageTransition>
                    </Suspense>
                  </main>

                  <GlobalBugTrigger />
                  <PWAInstallHint />
                  <MobileBottomNav />
                </DynamicThemeProvider>
              </NativeWrapper>
            </ErrorBoundary>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

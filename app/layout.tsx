import { Suspense } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Loading from './loading';
import NativeWrapper from '@/components/NativeWrapper';
import PageTransition from '@/components/PageTransition';
import OfflineStatus from '@/components/OfflineStatus';
import AppNavbar from '@/components/AppNavbar';
import AppFooter from '@/components/AppFooter';

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
      <body className={inter.className} style={{ backgroundColor: '#15151e', minHeight: '100vh', overflowX: 'hidden' }}>
        <NativeWrapper>
          <div className="d-flex flex-column min-vh-100">
            <AppNavbar />
            <OfflineStatus />
            <PageTransition>
              <Suspense fallback={<Loading />}>
                {children}
              </Suspense>
            </PageTransition>
            <AppFooter />
          </div>
        </NativeWrapper>
      </body>
    </html>
  );
}

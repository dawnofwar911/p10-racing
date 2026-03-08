import { Suspense } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Loading from './loading';
import NativeWrapper from '@/components/NativeWrapper';
import PageTransition from '@/components/PageTransition';
import OfflineStatus from '@/components/OfflineStatus';

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
        <NativeWrapper>
          <OfflineStatus />
          <Suspense fallback={<Loading />}>
            <PageTransition>
              <div className="page-transition">
                {children}
              </div>
            </PageTransition>
          </Suspense>
        </NativeWrapper>
      </body>
    </html>
  );
}

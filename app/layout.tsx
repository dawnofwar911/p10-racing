import { Suspense } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Loading from './loading';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'P10 Racing',
  description: 'F1 Midfield Prediction Game',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#e10600',
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
    <html lang="en">
      <body className={inter.className}>
        <div style={{ backgroundColor: '#15151e', minHeight: '100vh' }}>
          <Suspense fallback={<Loading />}>
            <div className="page-transition">
              {children}
            </div>
          </Suspense>
        </div>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SessionSync from '@/components/auth/SessionSync';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'DoctorTrio Admin',
  description: 'DoctorTrio Admin Panel — Hospital & Clinic Management',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D7A7A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className={inter.variable}>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <SessionSync />
        {children}
      </body>
    </html>
  );
}

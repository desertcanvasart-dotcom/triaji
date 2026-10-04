import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import MarketingAnalytics from '@/components/MarketingAnalytics';
import { measurementId } from '@/lib/marketing-analytics';
import { SITE_ORIGIN } from '@/lib/seo';
import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  robots: { index: false, follow: false },
  title: 'دكتور تريو — الدكتور الصح، في المكان الصح',
  description: 'منصة فرز طبي ذكية بالعربي — الدكتور الصح، في المكان الصح',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D7A7A',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get('x-site-locale') === 'en' ? 'en' : 'ar';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={cairo.variable}>
      <body className="font-cairo bg-white text-gray-900 antialiased">
        {children}
        <MarketingAnalytics configured={measurementId() !== null} />
      </body>
    </html>
  );
}

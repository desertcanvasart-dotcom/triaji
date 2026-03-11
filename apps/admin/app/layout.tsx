import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'تريجي — لوحة التحكم',
  description: 'لوحة تحكم تريجي للمستشفيات والعيادات',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-cairo bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ترياچي — الدكتور الصح، في المكان الصح',
  description: 'منصة فرز طبي ذكية بالعربي — الدكتور الصح، في المكان الصح',
};

export default function RootLayout({
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
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-cairo bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { publicPage } from '@/lib/seo';

const CONSENT_COOKIE = 'doctortrio-analytics-consent';
type Consent = 'granted' | 'denied' | 'unset';

export default function MarketingAnalytics({ configured }: { configured: boolean }) {
  const pathname = usePathname();
  const page = publicPage(pathname);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const stored = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${CONSENT_COOKIE}=`))?.split('=')[1];
    setConsent(stored === 'granted' || stored === 'denied' ? stored : 'unset');
  }, []);

  if (!configured || !page || consent === null) return null;
  const ar = page.locale === 'ar';
  const decide = (value: 'granted' | 'denied') => {
    document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setConsent(value);
    setEditing(false);
  };

  return <>
    {consent === 'granted' && <iframe
      key={pathname}
      src={`/analytics-frame?path=${encodeURIComponent(pathname)}`}
      title="Marketing analytics"
      aria-hidden="true"
      tabIndex={-1}
      referrerPolicy="no-referrer"
      className="fixed bottom-0 left-0 w-px h-px border-0 opacity-0 pointer-events-none"
    />}
    {consent === 'unset' || editing ? <section aria-label={ar ? 'إعدادات ملفات الارتباط' : 'Cookie settings'} dir={ar ? 'rtl' : 'ltr'} className="fixed bottom-4 inset-x-4 sm:left-auto sm:w-96 z-50 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <p className="text-sm text-gray-700 mb-3">{ar ? 'بموافقتك، نستخدم ملفات ارتباط لقياس زيارة الصفحات التعريفية فقط. لا نرسل المحادثات الطبية أو بيانات النماذج إلى Google Analytics.' : 'With your permission, we use cookies to measure visits to our information pages. Medical conversations and form contents are not sent to Google Analytics.'}</p>
      <div className="flex justify-end gap-3">
        <button onClick={() => decide('denied')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">{ar ? 'رفض' : 'Decline'}</button>
        <button onClick={() => decide('granted')} className="rounded-lg bg-teal-700 text-white px-3 py-2 text-sm">{ar ? 'موافقة' : 'Accept'}</button>
      </div>
    </section> : <button onClick={() => setEditing(true)} className="fixed bottom-2 start-2 z-40 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600">{ar ? 'إعدادات ملفات الارتباط' : 'Cookie settings'}</button>}
  </>;
}

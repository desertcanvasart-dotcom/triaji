'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { t } from '@triaji/shared/i18n/strings';

function FailedContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') ?? '';
  const lang = 'en';

  return (
    <div
      dir="ltr"
      className="min-h-screen bg-gray-50 flex items-center justify-center px-4"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-md text-center">
        {/* Red X */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('payment.payFailed', lang)}
        </h1>

        <p className="text-gray-600 text-base mb-6">
          {t('payment.errorOccurred', lang)}
        </p>

        {/* Try again — back to checkout */}
        {reference ? (
          <a
            href={`/en/pay/${reference}`}
            className="block w-full bg-red-600 text-white font-semibold rounded-xl py-3 text-center min-h-[44px] flex items-center justify-center active:bg-red-700 transition-colors"
          >
            {t('payment.tryAgain', lang)}
          </a>
        ) : (
          <a
            href="/en"
            className="block w-full bg-blue-600 text-white font-semibold rounded-xl py-3 text-center min-h-[44px] flex items-center justify-center active:bg-blue-700 transition-colors"
          >
            {t('payment.backToHome', lang)}
          </a>
        )}
      </div>
    </div>
  );
}

export default function EnglishPayFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <FailedContent />
    </Suspense>
  );
}

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { t } from '@triaji/shared/i18n/strings';

function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') ?? '';
  const amount = searchParams.get('amount') ?? '';
  const method = searchParams.get('method') ?? '';
  const lang = 'en';

  const providerLabels: Record<string, string> = {
    fawry: 'Fawry',
    paymob: 'Card',
    vodafone_cash: 'Vodafone Cash',
  };

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
        {/* Green checkmark */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('payment.paySuccess', lang)}
        </h1>

        {/* Receipt details */}
        <div className="bg-gray-50 rounded-xl p-4 mt-4 space-y-3 text-left">
          {reference && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {t('payment.reference', lang)}
              </span>
              <span className="text-sm text-gray-500">{reference}</span>
            </div>
          )}
          {amount && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {t('payment.amount', lang)}
              </span>
              <span className="text-sm text-gray-500">EGP {Number(amount).toFixed(2)}</span>
            </div>
          )}
          {method && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {t('payment.paymentMethod', lang)}
              </span>
              <span className="text-sm text-gray-500">{providerLabels[method] ?? method}</span>
            </div>
          )}
        </div>

        {/* WhatsApp receipt notice */}
        <div className="flex items-center justify-center gap-2 mt-5 bg-green-50 rounded-xl p-3">
          <span className="text-lg">📩</span>
          <p className="text-sm text-green-700 font-medium">
            {t('payment.receiptOnWhatsApp', lang)}
          </p>
        </div>

        {/* Back to home */}
        <a
          href="/en"
          className="block w-full mt-6 bg-blue-600 text-white font-semibold rounded-xl py-3 text-center min-h-[44px] flex items-center justify-center active:bg-blue-700 transition-colors"
        >
          {t('payment.backToHome', lang)}
        </a>
      </div>
    </div>
  );
}

export default function EnglishPaySuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

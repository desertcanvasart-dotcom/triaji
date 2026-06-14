'use client';

/**
 * PaymentCheckout — Mobile-first payment page component.
 * Opened primarily from WhatsApp links on phones.
 *
 * State machine: loading → ready → selecting_method → processing → success | failed | expired
 *
 * Design principles:
 * - Large touch targets (min-height: 44px for all interactive elements)
 * - Full-width cards on mobile
 * - 16px minimum font size
 * - No horizontal scroll on 375px viewport
 * - Safe area padding for iOS notch
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n/strings';

// ─── Types ─────────────────────────────────────────────────────────────────────

type CheckoutState =
  | 'loading'
  | 'ready'
  | 'selecting_method'
  | 'processing'
  | 'success'
  | 'failed'
  | 'expired';

type PaymentMethod = 'paymob' | 'fawry' | 'vodafone_cash';

interface PaymentData {
  id: string;
  triaji_reference: string;
  payable_type: string;
  provider: string;
  fawry_code: string | null;
  amount_egp: number;
  currency: string;
  status: string;
  description_ar: string;
  description_en: string;
  providerName_ar: string;
  providerName_en: string;
  initiated_at: string;
}

interface Props {
  reference: string;
  lang: Lang;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PaymentCheckout({ reference, lang }: Props) {
  const router = useRouter();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const isAr = lang === 'ar';

  const [state, setState] = useState<CheckoutState>('loading');
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [error, setError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [copied, setCopied] = useState(false);
  const [vfPhone, setVfPhone] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch payment data ────────────────────────────────────────────────────

  const fetchPayment = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/${reference}`);
      if (!res.ok) {
        setState('failed');
        setError(t('payment.errorOccurred', lang));
        return;
      }

      const data: PaymentData = await res.json();
      setPayment(data);

      if (data.status === 'completed') {
        setState('success');
        router.push(
          `/${lang}/pay/success?reference=${reference}&amount=${data.amount_egp}&method=${data.provider}`,
        );
        return;
      }

      if (data.status === 'expired') {
        setState('expired');
        return;
      }

      if (data.status === 'failed') {
        setState('failed');
        return;
      }

      setState('ready');
    } catch {
      setState('failed');
      setError(t('payment.errorOccurred', lang));
    }
  }, [reference, lang, router]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  // ─── Polling for Vodafone Cash ─────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${reference}`);
        if (!res.ok) return;

        const data: PaymentData = await res.json();

        if (data.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          router.push(
            `/${lang}/pay/success?reference=${reference}&amount=${data.amount_egp}&method=${data.provider}`,
          );
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setState('failed');
        } else if (data.status === 'expired') {
          if (pollRef.current) clearInterval(pollRef.current);
          setState('expired');
        }
      } catch {
        // Silent retry on next poll
      }
    }, 5000);
  }, [reference, lang, router]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setState('selecting_method');
  };

  const handlePaymobRedirect = () => {
    // Initiate payment then redirect
    setState('processing');
    initiateAndRedirect('paymob');
  };

  const handleFawryOnlineRedirect = () => {
    setState('processing');
    initiateAndRedirect('fawry');
  };

  const handleVodafoneSubmit = () => {
    if (!vfPhone || vfPhone.length < 11) return;
    setState('processing');
    initiateVodafone();
  };

  const initiateAndRedirect = async (provider: PaymentMethod) => {
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payable_type: payment?.payable_type,
          payable_id: payment?.id,
          provider,
          return_url: `${window.location.origin}/${lang}/pay/success?reference=${reference}`,
        }),
      });

      const data = await res.json();

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.fawryCode) {
        // Reload to show Fawry code
        await fetchPayment();
        setState('selecting_method');
        setSelectedMethod('fawry');
      } else {
        setState('failed');
        setError(data.error ?? t('payment.errorOccurred', lang));
      }
    } catch {
      setState('failed');
      setError(t('payment.errorOccurred', lang));
    }
  };

  const initiateVodafone = async () => {
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payable_type: payment?.payable_type,
          payable_id: payment?.id,
          provider: 'vodafone_cash',
        }),
      });

      const data = await res.json();

      if (data.reference) {
        // Start polling for VF Cash confirmation
        startPolling();
      } else {
        setState('failed');
        setError(data.error ?? t('payment.errorOccurred', lang));
      }
    } catch {
      setState('failed');
      setError(t('payment.errorOccurred', lang));
    }
  };

  const copyFawryCode = async () => {
    if (!payment?.fawry_code) return;
    try {
      await navigator.clipboard.writeText(payment.fawry_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = payment.fawry_code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────

  const description = isAr
    ? payment?.description_ar ?? ''
    : payment?.description_en ?? '';

  const providerName = isAr
    ? payment?.providerName_ar ?? ''
    : payment?.providerName_en ?? '';

  const amountFormatted = payment
    ? isAr
      ? `${Number(payment.amount_egp).toFixed(2)} جنيه`
      : `EGP ${Number(payment.amount_egp).toFixed(2)}`
    : '';

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div
        dir={dir}
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 text-base">{t('payment.processing', lang)}</p>
        </div>
      </div>
    );
  }

  // ─── Expired state ─────────────────────────────────────────────────────────

  if (state === 'expired') {
    return (
      <div
        dir={dir}
        className="min-h-screen bg-gray-50 flex items-center justify-center px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('payment.payExpired', lang)}</h2>
          <p className="text-gray-600 mb-6 text-base">{t('payment.slotReleased', lang)}</p>
          <a
            href={`/${lang}`}
            className="block w-full bg-blue-600 text-white font-semibold rounded-xl py-3 text-center min-h-[44px] flex items-center justify-center"
          >
            {t('payment.bookAgain', lang)}
          </a>
        </div>
      </div>
    );
  }

  // ─── Main checkout ─────────────────────────────────────────────────────────

  return (
    <div
      dir={dir}
      className="min-h-screen bg-gray-50"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold text-gray-900">{t('payment.pageTitle', lang)}</h1>
          {providerName && (
            <p className="text-sm text-gray-500 mt-1">{providerName}</p>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Invoice summary card */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-1">{t('payment.invoiceSummary', lang)}</p>
          <p className="text-base text-gray-800 font-medium mb-4">{description}</p>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">{t('payment.amountDue', lang)}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{amountFormatted}</p>
          </div>
        </div>

        {/* Processing overlay */}
        {state === 'processing' && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-700 text-base font-medium">{t('payment.processing', lang)}</p>
          </div>
        )}

        {/* Error message */}
        {state === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-red-800 mb-2">{t('payment.payFailed', lang)}</h3>
            <p className="text-red-600 mb-4 text-base">{error || t('payment.errorOccurred', lang)}</p>
            <button
              onClick={() => { setState('ready'); setError(''); setSelectedMethod(null); }}
              className="w-full bg-red-600 text-white font-semibold rounded-xl py-3 min-h-[44px]"
            >
              {t('payment.tryAgain', lang)}
            </button>
          </div>
        )}

        {/* Payment method selection */}
        {(state === 'ready' || state === 'selecting_method') && !selectedMethod && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 px-1">
              {t('payment.chooseMethod', lang)}
            </p>

            {/* Card / Paymob */}
            <button
              onClick={() => handleSelectMethod('paymob')}
              className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 min-h-[64px] active:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-2xl">💳</span>
              </div>
              <div className={`flex-1 ${isAr ? 'text-right' : 'text-left'}`}>
                <p className="font-semibold text-gray-900 text-base">
                  {t('payment.payWithCard', lang)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visa, Mastercard, Meeza
                </p>
              </div>
              <svg className={`w-5 h-5 text-gray-400 shrink-0 ${isAr ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Fawry */}
            <button
              onClick={() => handleSelectMethod('fawry')}
              className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 min-h-[64px] active:bg-gray-50 transition-colors border border-gray-200 hover:border-orange-300"
            >
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-2xl">🟠</span>
              </div>
              <div className={`flex-1 ${isAr ? 'text-right' : 'text-left'}`}>
                <p className="font-semibold text-gray-900 text-base">
                  {t('payment.payWithFawry', lang)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isAr ? 'منفذ فوري • ATM • أونلاين' : 'Fawry outlet, ATM, or online'}
                </p>
              </div>
              <svg className={`w-5 h-5 text-gray-400 shrink-0 ${isAr ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Vodafone Cash */}
            <button
              onClick={() => handleSelectMethod('vodafone_cash')}
              className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 min-h-[64px] active:bg-gray-50 transition-colors border border-gray-200 hover:border-red-300"
            >
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-2xl">🔴</span>
              </div>
              <div className={`flex-1 ${isAr ? 'text-right' : 'text-left'}`}>
                <p className="font-semibold text-gray-900 text-base">
                  {t('payment.payWithVF', lang)}
                </p>
              </div>
              <svg className={`w-5 h-5 text-gray-400 shrink-0 ${isAr ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* ─── Fawry Flow ─────────────────────────────────────────────────────── */}
        {selectedMethod === 'fawry' && state === 'selecting_method' && (
          <div className="space-y-4">
            {/* Back button */}
            <button
              onClick={() => { setSelectedMethod(null); setState('ready'); }}
              className={`flex items-center gap-2 text-blue-600 font-medium min-h-[44px] ${isAr ? 'flex-row-reverse' : ''}`}
            >
              <svg className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('payment.chooseMethod', lang)}
            </button>

            {/* Fawry code display */}
            {payment?.fawry_code && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <p className="text-sm text-gray-500 mb-3">{t('payment.fawryCode', lang)}</p>

                <div className="bg-orange-50 rounded-xl p-4 flex items-center justify-between gap-3">
                  <span
                    className="text-2xl font-mono font-bold text-orange-700 tracking-widest select-all"
                    dir="ltr"
                  >
                    {payment.fawry_code}
                  </span>
                  <button
                    onClick={copyFawryCode}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] shrink-0 active:bg-orange-600"
                  >
                    {copied ? t('payment.copied', lang) : t('payment.copyCode', lang)}
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600">
                    📍 {t('payment.fawryAtmInstructions', lang)}
                  </p>
                  <p className="text-sm text-orange-600 font-medium">
                    ⏰ {t('payment.fawryValidFor', lang)}
                  </p>
                </div>
              </div>
            )}

            {/* Divider: "or" + online redirect */}
            <div className="flex items-center gap-3 px-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400 font-medium">{t('payment.orDivider', lang)}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              onClick={handleFawryOnlineRedirect}
              className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-base min-h-[48px] active:bg-orange-600 transition-colors"
            >
              {t('payment.fawryOnlineRedirect', lang)}
            </button>
          </div>
        )}

        {/* ─── Paymob Flow ────────────────────────────────────────────────────── */}
        {selectedMethod === 'paymob' && state === 'selecting_method' && (
          <div className="space-y-4">
            {/* Back button */}
            <button
              onClick={() => { setSelectedMethod(null); setState('ready'); }}
              className={`flex items-center gap-2 text-blue-600 font-medium min-h-[44px] ${isAr ? 'flex-row-reverse' : ''}`}
            >
              <svg className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('payment.chooseMethod', lang)}
            </button>

            <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💳</span>
              </div>
              <p className="text-gray-700 text-base mb-6">
                {isAr
                  ? 'هيتم توجيهك لصفحة الدفع الآمنة'
                  : 'You will be redirected to the secure payment page'}
              </p>
              <button
                onClick={handlePaymobRedirect}
                className="w-full bg-blue-600 text-white font-semibold rounded-xl py-3.5 text-base min-h-[48px] active:bg-blue-700 transition-colors"
              >
                {t('payment.payNow', lang)}
              </button>
            </div>
          </div>
        )}

        {/* ─── Vodafone Cash Flow ─────────────────────────────────────────────── */}
        {selectedMethod === 'vodafone_cash' && state === 'selecting_method' && (
          <div className="space-y-4">
            {/* Back button */}
            <button
              onClick={() => { setSelectedMethod(null); setState('ready'); }}
              className={`flex items-center gap-2 text-blue-600 font-medium min-h-[44px] ${isAr ? 'flex-row-reverse' : ''}`}
            >
              <svg className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('payment.chooseMethod', lang)}
            </button>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('payment.vfPhoneLabel', lang)}
              </label>
              <input
                type="tel"
                dir="ltr"
                placeholder="010XXXXXXXX"
                value={vfPhone}
                onChange={(e) => setVfPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={11}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg text-center font-mono min-h-[48px] focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-2">
                {t('payment.vfPhonePrompt', lang)}
              </p>

              <button
                onClick={handleVodafoneSubmit}
                disabled={vfPhone.length < 11}
                className="w-full mt-4 bg-red-600 text-white font-semibold rounded-xl py-3.5 text-base min-h-[48px] active:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {t('payment.confirmPay', lang)}
              </button>
            </div>
          </div>
        )}

        {/* Vodafone Cash waiting */}
        {selectedMethod === 'vodafone_cash' && state === 'processing' && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-700 text-base font-medium mb-2">
              {t('payment.vfWaiting', lang)}
            </p>
            <p className="text-sm text-gray-500">
              {t('payment.vfPhonePrompt', lang)}
            </p>
          </div>
        )}

        {/* Security notice */}
        {(state === 'ready' || state === 'selecting_method') && (
          <div className="flex items-center justify-center gap-2 py-4">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-gray-400">
              {t('payment.noCardStorage', lang)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

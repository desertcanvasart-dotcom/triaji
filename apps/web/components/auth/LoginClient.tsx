'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { s, type Lang } from '@triaji/shared/i18n';

type LoginStep = 'phone' | 'otp';

interface LoginClientProps {
  lang: Lang;
}

export default function LoginClient({ lang }: LoginClientProps) {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const otpInputRef = useRef<HTMLInputElement>(null);

  const isRtl = lang === 'ar';

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/patient/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? s.login.defaultError[lang]);
        return;
      }

      setStep('otp');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch {
      setError(s.login.connectionError[lang]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/patient/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? s.login.invalidOtp[lang]);
        return;
      }

      router.push(`/${lang}/history`);
    } catch {
      setError(s.login.connectionError[lang]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">{s.common.appName[lang]}</h1>
          <span className="text-sm opacity-80">{s.login.title[lang]}</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{s.login.subtitle[lang]}</h2>
              <p className="text-gray-500">{s.login.description[lang]}</p>
            </div>

            {step === 'phone' ? (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    {s.login.phoneLabel[lang]}
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-left ltr-nums focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !phone.trim()}
                  className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? s.login.sendingOtp[lang] : s.login.sendOtp[lang]}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  {s.login.otpSentVia[lang]}
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                    {s.login.otpLabel[lang]}
                  </label>
                  <input
                    id="otp"
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="______"
                    maxLength={6}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] ltr-nums focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {s.login.otpSentTo[lang]} {phone}
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || otp.length < 6}
                  className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? s.login.verifying[lang] : s.login.verifyOtp[lang]}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                  className="w-full text-gray-500 py-2 text-sm hover:text-gray-700 transition-colors"
                >
                  {s.login.changeNumber[lang]}
                </button>
              </form>
            )}
          </div>

          <div className="text-center mt-6">
            <Link href={`/${lang}/chat`} className="text-teal-600 text-sm font-medium hover:underline">
              {s.login.skipLogin[lang]}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

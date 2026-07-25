'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 'email' | 'reset';

interface ApiResponse {
  success?: boolean;
  error?: string;
  phone_hint?: string | null;
}

export default function DoctorForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const router = useRouter();

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('البريد الإلكتروني مطلوب');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/doctor/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale: 'ar' }),
      });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'حصلت مشكلة، حاول تاني');
        return;
      }

      setPhoneHint(data.phone_hint ?? null);
      setStep('reset');
    } catch {
      setError('مفيش اتصال بالسيرفر، حاول تاني');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      setError('اكتب الرمز اللي وصلك');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور لازم تكون 8 حروف على الأقل');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتين المرور مش متطابقين');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/doctor/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), password, locale: 'ar' }),
      });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'الرمز غير صحيح أو انتهت صلاحيته');
        return;
      }

      setIsDone(true);
      setTimeout(() => router.push('/ar/doctor/login'), 2500);
    } catch {
      setError('مفيش اتصال بالسيرفر، حاول تاني');
    } finally {
      setIsLoading(false);
    }
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-md mx-auto px-4 pt-16 pb-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">تم تغيير كلمة المرور</h2>
            <p className="text-gray-600 text-sm mb-6">هنوديك لصفحة الدخول دلوقتي...</p>
            <Link href="/ar/doctor/login" className="text-teal-600 font-semibold hover:text-teal-700">
              الذهاب لصفحة الدخول ←
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-md mx-auto px-4 pt-16 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">نسيت كلمة المرور</h1>
          <p className="text-gray-500 text-sm mb-8">
            {step === 'email'
              ? 'اكتب بريدك الإلكتروني وهنبعتلك رمز تحقق على رقم الموبايل المسجل عندنا.'
              : phoneHint
                ? `بعتنا رمز تحقق على الرقم ${phoneHint}. اكتبه واختار كلمة مرور جديدة.`
                : 'لو البريد ده مسجل عندنا، هيوصل رمز تحقق على رقم الموبايل المسجل. اكتبه واختار كلمة مرور جديدة.'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">{error}</div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <Field label="البريد الإلكتروني">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  dir="ltr"
                  className={inputClass}
                />
              </Field>

              <button type="submit" disabled={isLoading} className={buttonClass}>
                {isLoading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <Field label="رمز التحقق">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  dir="ltr"
                  autoFocus
                  className={`${inputClass} tracking-[0.4em] text-center`}
                />
              </Field>

              <Field label="كلمة المرور الجديدة">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 حروف على الأقل"
                  className={inputClass}
                />
              </Field>

              <Field label="تأكيد كلمة المرور">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  className={inputClass}
                />
              </Field>

              <button type="submit" disabled={isLoading} className={buttonClass}>
                {isLoading ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError('');
                }}
                className="w-full text-sm text-gray-500 hover:text-teal-600 transition-colors"
              >
                تعديل البريد الإلكتروني
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            فاكر كلمة المرور؟{' '}
            <Link href="/ar/doctor/login" className="text-teal-600 font-semibold hover:text-teal-700">
              سجّل دخول
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal-500 bg-white';

const buttonClass =
  'w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-teal-600">
          دكتور تريو
        </Link>
        <Link
          href="/ar/doctor/login"
          className="text-sm font-semibold text-[#1A2F4A] hover:text-teal-600 transition-colors"
        >
          دخول الأطباء
        </Link>
      </div>
    </nav>
  );
}

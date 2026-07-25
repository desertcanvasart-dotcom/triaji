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
      setError('Email is required');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/doctor/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale: 'en' }),
      });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Something went wrong, please try again');
        return;
      }

      setPhoneHint(data.phone_hint ?? null);
      setStep('reset');
    } catch {
      setError('Cannot connect to server, please try again');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      setError('Enter the code we sent you');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/doctor/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), password, locale: 'en' }),
      });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'The code is invalid or has expired');
        return;
      }

      setIsDone(true);
      setTimeout(() => router.push('/en/doctor/login'), 2500);
    } catch {
      setError('Cannot connect to server, please try again');
    } finally {
      setIsLoading(false);
    }
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-gray-50" dir="ltr">
        <Navbar />
        <main className="max-w-md mx-auto px-4 pt-16 pb-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Password updated</h2>
            <p className="text-gray-600 text-sm mb-6">Taking you to the sign-in page...</p>
            <Link href="/en/doctor/login" className="text-teal-600 font-semibold hover:text-teal-700">
              Go to sign in →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <Navbar />
      <main className="max-w-md mx-auto px-4 pt-16 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">Forgot password</h1>
          <p className="text-gray-500 text-sm mb-8">
            {step === 'email'
              ? 'Enter your email and we will send a verification code to the mobile number on your account.'
              : phoneHint
                ? `We sent a verification code to ${phoneHint}. Enter it and choose a new password.`
                : 'If that email is registered, a verification code has been sent to the mobile number on file. Enter it and choose a new password.'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">{error}</div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  className={inputClass}
                />
              </Field>

              <button type="submit" disabled={isLoading} className={buttonClass}>
                {isLoading ? 'Sending...' : 'Send verification code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <Field label="Verification code">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                  className={`${inputClass} tracking-[0.4em] text-center`}
                />
              </Field>

              <Field label="New password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputClass}
                />
              </Field>

              <Field label="Confirm password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter the password"
                  className={inputClass}
                />
              </Field>

              <button type="submit" disabled={isLoading} className={buttonClass}>
                {isLoading ? 'Saving...' : 'Change password'}
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
                Change email address
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            Remembered your password?{' '}
            <Link href="/en/doctor/login" className="text-teal-600 font-semibold hover:text-teal-700">
              Sign in
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
          DoctorTrio
        </Link>
        <Link
          href="/en/doctor/login"
          className="text-sm font-semibold text-[#1A2F4A] hover:text-teal-600 transition-colors"
        >
          Doctor login
        </Link>
      </div>
    </nav>
  );
}

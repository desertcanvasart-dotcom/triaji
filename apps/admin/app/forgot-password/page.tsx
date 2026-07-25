'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 'email' | 'otp' | 'email-sent';

interface ForgotResponse {
  success?: boolean;
  error?: string;
  channel?: 'phone' | 'email';
  phone_hint?: string | null;
}

/**
 * Admin password reset.
 *
 * Admins with a mobile on file get a WhatsApp/SMS code they redeem here;
 * everyone else gets a Supabase recovery email that lands on /set-password.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as ForgotResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      if (data.channel === 'phone') {
        setPhoneHint(data.phone_hint ?? null);
        setStep('otp');
      } else {
        setStep('email-sent');
      }
    } catch {
      setError('Cannot reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      setError('Enter the code we sent you.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), password }),
      });
      const data = (await res.json()) as ForgotResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'That code is incorrect or has expired.');
        return;
      }

      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Cannot reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">T</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 'otp'
              ? phoneHint
                ? `We sent a code to ${phoneHint}`
                : 'Enter the code we sent you'
              : 'We will send you a way back into your account'}
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-gray-900">Password updated</p>
            <p className="text-sm text-gray-500">Taking you to the sign-in page...</p>
            <Link href="/login" className="text-sm text-teal-600 font-semibold hover:text-teal-700">
              Go to sign in →
            </Link>
          </div>
        ) : step === 'email-sent' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
            <p className="text-sm text-gray-700">
              If <span className="font-semibold">{email.trim()}</span> belongs to an active admin
              account, we have emailed a password reset link. It expires in one hour.
            </p>
            <p className="text-xs text-gray-500">
              No email after a few minutes? Check spam, or ask a platform admin to add a mobile
              number to your account so we can text you a code instead.
            </p>
            <Link href="/login" className="block text-sm text-teal-600 font-semibold hover:text-teal-700">
              Back to sign in
            </Link>
          </div>
        ) : step === 'email' ? (
          <form
            onSubmit={requestCode}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4"
          >
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@hospital.com"
                required
                autoComplete="email"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Continue'}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm text-gray-500 hover:text-teal-600"
            >
              Back to sign in
            </Link>
          </form>
        ) : (
          <form
            onSubmit={submitReset}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4"
          >
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>
            )}

            <div>
              <label htmlFor="otp" className="label">
                Verification code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field tracking-[0.4em] text-center"
                placeholder="000000"
                autoFocus
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="label">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field"
                placeholder="Re-enter the password"
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Saving...' : 'Change password'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setOtp('');
                setError('');
              }}
              className="block w-full text-center text-sm text-gray-500 hover:text-teal-600"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

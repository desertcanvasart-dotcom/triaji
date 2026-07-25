'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LoginResponse {
  success?: boolean;
  error?: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  token?: string;
}

export default function DoctorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/doctor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json()) as LoginResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Invalid email or password');
        return;
      }

      switch (data.verification_status) {
        case 'pending':
          router.push('/en/doctor/pending');
          break;
        case 'rejected':
          setError(
            data.rejection_reason
              ? `Account rejected: ${data.rejection_reason}`
              : 'Your registration was rejected. Contact us for help.'
          );
          break;
        case 'verified':
          router.push('/en/doctor/dashboard');
          break;
        default:
          router.push('/en/doctor/pending');
      }
    } catch {
      setError('Cannot connect to server, please try again');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <Navbar />
      <main className="max-w-md mx-auto px-4 pt-16 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">Doctor login</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to manage your account and appointments</p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal-500 bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <Link
                  href="/en/doctor/forgot-password"
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal-500 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/en/doctor/register" className="text-teal-600 font-semibold hover:text-teal-700">
              Register as a doctor
            </Link>
          </p>
        </div>
      </main>
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

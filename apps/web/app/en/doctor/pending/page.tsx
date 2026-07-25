'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DoctorPendingPage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/doctor/auth/logout', { method: 'POST' });
    } catch {
      // Proceed with redirect even if logout request fails
    }
    router.push('/en/doctor/login');
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <nav className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-teal-600">
            DoctorTrio
          </Link>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </nav>

      <main className="max-w-md mx-auto px-4 pt-16 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-4">Your account is under review</h1>

          <p className="text-gray-600 leading-relaxed mb-8">
            We are verifying your syndicate number to confirm your identity. This process takes 24–48 hours.
            You will receive a confirmation email once approved.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-start">
            <p className="text-sm text-amber-900 font-semibold mb-1">We need your verification documents</p>
            <p className="text-sm text-amber-800 leading-relaxed">
              To review your account, upload your syndicate card, national ID and medical degree.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/en/doctor/documents"
              className="block w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors"
            >
              Upload documents
            </Link>

            <a
              href="mailto:support@doctortrio.online"
              className="inline-block w-full border-2 border-teal-600 text-teal-600 font-semibold py-3 rounded-xl hover:bg-teal-50 transition-colors"
            >
              Contact us
            </a>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

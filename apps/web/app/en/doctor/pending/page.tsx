'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Status = 'pending' | 'verified' | 'rejected' | 'loading';

export default function DoctorPendingPage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const router = useRouter();

  // Poll the real account status so the doctor sees the decision without having
  // to log out and back in. Once verified we send them straight to the dashboard.
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/doctor/auth/me');
      if (!res.ok) return;
      const data = await res.json();
      const vs = data?.doctorAccount?.verification_status as Status | undefined;
      if (vs === 'verified') {
        router.replace('/en/doctor/dashboard');
        return;
      }
      if (vs === 'rejected') {
        setRejectionReason(data?.doctorAccount?.rejection_reason ?? null);
        setStatus('rejected');
        return;
      }
      setStatus('pending');
    } catch {
      // Keep showing the last known state on a transient error.
    }
  }, [router]);

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 15000);
    return () => clearInterval(timer);
  }, [checkStatus]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/doctor/auth/logout', { method: 'POST' });
    } catch {
      // Proceed with redirect even if logout request fails
    }
    router.push('/en/doctor/login');
  }

  const isRejected = status === 'rejected';

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
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isRejected ? 'bg-red-100' : 'bg-amber-100'
            }`}
          >
            {isRejected ? (
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-4">
            {isRejected ? 'We need another look at your account' : 'Your account is under review'}
          </h1>

          {isRejected ? (
            <>
              <p className="text-gray-600 leading-relaxed mb-4">
                We couldn&apos;t verify your account this time. Please fix the point below and re-upload your documents.
              </p>
              {rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-start">
                  <p className="text-sm text-red-900 font-semibold mb-1">Reason</p>
                  <p className="text-sm text-red-800 leading-relaxed">{rejectionReason}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-gray-600 leading-relaxed mb-8">
                We are verifying your syndicate number and documents to confirm your identity. This takes 24–48 hours.
                This page updates itself once you&apos;re approved, and we&apos;ll message you too.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-start">
                <p className="text-sm text-amber-900 font-semibold mb-1">We need your verification documents</p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  To review your account, upload your syndicate card, national ID (both sides) and medical degree.
                </p>
              </div>
            </>
          )}

          <div className="space-y-4">
            <Link
              href="/en/doctor/documents"
              className="block w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors"
            >
              {isRejected ? 'Edit documents' : 'Upload documents'}
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

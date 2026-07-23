'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Landing page for admin invite / recovery links.
 *
 * Supabase's verify endpoint redirects here with the session tokens in the
 * URL hash (#access_token=…&refresh_token=…&type=invite|recovery). We adopt
 * that session, let the user choose a password, then sign out and send them
 * to the normal login flow.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const hashError = hash.get('error_description');

    if (hashError) {
      setLinkError(hashError.replace(/\+/g, ' '));
      return;
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: sessionError }) => {
          if (sessionError) {
            setLinkError('This link is invalid or has expired. Ask your administrator for a new one.');
          } else {
            // Keep tokens out of the address bar / history once adopted.
            window.history.replaceState(null, '', window.location.pathname);
            setReady(true);
          }
        });
      return;
    }

    // No tokens in the URL — maybe a session already exists (page refresh).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        setLinkError('This link is invalid or has expired. Ask your administrator for a new one.');
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const supabase = getSupabaseBrowser();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => router.push('/login'), 1500);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Set your password</h1>
        <p className="text-sm text-gray-500 mb-6">DoctorTrio Admin</p>

        {linkError ? (
          <p className="text-sm text-red-600">{linkError}</p>
        ) : done ? (
          <p className="text-sm text-teal-700">
            Password set. Redirecting you to the login page…
          </p>
        ) : !ready ? (
          <p className="text-sm text-gray-500">Verifying your invite link…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input
              className="input-field w-full"
              type="password"
              placeholder="New password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <input
              className="input-field w-full"
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Saving…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

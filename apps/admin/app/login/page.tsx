'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { getClinicRedirect, getLabRedirect, getPharmacyRedirect, getInsuranceRedirect, isIcuHospitalRole, getIcuRedirect, getChainRedirect } from '@/lib/auth/types';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    errorParam === 'not_admin' ? 'This account does not have admin access.' : ''
  );
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = getSupabaseBrowser();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.session) {
        setError('Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      // Set the httpOnly session cookies server-side (JS can't set httpOnly).
      await fetch('/api/admin/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });

      // Verify admin status via API
      const res = await fetch('/api/admin/auth/verify', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      if (!res.ok) {
        setError('This account does not have admin access.');
        await fetch('/api/admin/auth/session', { method: 'DELETE' });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Redirect chain roles to their specific dashboard
      const verifyData = await res.json();
      const chainRedirect = verifyData?.role ? getChainRedirect(verifyData.role) : null;
      if (chainRedirect) {
        router.push(chainRedirect);
        return;
      }
      // branch_manager: redirect to their branch admin based on tenant tier
      if (verifyData?.role === 'branch_manager') {
        // branch_manager uses clinic/lab/pharmacy redirect based on their branch tier
        const bmClinic = getClinicRedirect('clinic_owner');
        if (bmClinic) {
          router.push(bmClinic);
          return;
        }
      }
      // Redirect clinic/lab roles to their specific dashboard
      const clinicRedirect = verifyData?.role ? getClinicRedirect(verifyData.role) : null;
      if (clinicRedirect) {
        router.push(clinicRedirect);
        return;
      }
      const labRedirect = verifyData?.role ? getLabRedirect(verifyData.role) : null;
      if (labRedirect) {
        router.push(labRedirect);
        return;
      }
      const pharmacyRedirect = verifyData?.role ? getPharmacyRedirect(verifyData.role) : null;
      if (pharmacyRedirect) {
        router.push(pharmacyRedirect);
        return;
      }
      const insuranceRedirect = verifyData?.role ? getInsuranceRedirect(verifyData.role) : null;
      if (insuranceRedirect) {
        router.push(insuranceRedirect);
        return;
      }
      if (verifyData?.role && isIcuHospitalRole(verifyData.role)) {
        const icuRedirect = getIcuRedirect(verifyData.role);
        if (icuRedirect && verifyData.role === 'icu_coordinator') {
          router.push(icuRedirect);
          return;
        }
      }

      router.push(redirectTo);
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900">Triajji Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to manage your clinic</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
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

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

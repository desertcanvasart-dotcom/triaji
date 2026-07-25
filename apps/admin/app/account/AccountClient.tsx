'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { getRoleBadge, type AdminRole } from '@/lib/auth/types';

interface Props {
  name: string;
  email: string;
  role: AdminRole;
  initialPhone: string | null;
  /** Where "back" goes — the dashboard this role actually lands on. */
  homeHref: string;
}

export default function AccountClient({ name, email, role, initialPhone, homeHref }: Props) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [saved, setSaved] = useState(initialPhone ?? '');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const badge = getRoleBadge(role);
  const dirty = phone.trim() !== (saved ?? '');

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone(false);
    setSaving(true);

    try {
      const res = await fetch('/api/admin/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() || null }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.error ?? 'Could not save your mobile.');
        return;
      }

      setSaved(data.phone ?? '');
      setPhone(data.phone ?? '');
      setDone(true);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="w-full max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My account</h1>
          <Link href={homeHref} className="text-sm text-gray-500 hover:text-teal-600">
            ← Back
          </Link>
        </div>

        <div className="card mb-4">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900 break-all">{email}</dd>
            </div>
            <div className="flex justify-between gap-4 items-center">
              <dt className="text-gray-500">Role</dt>
              <dd>
                <span className={`badge ${badge.className}`}>{badge.label}</span>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-400 mt-4">
            Name, email and role are managed by a platform admin.
          </p>
        </div>

        <form onSubmit={save} className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Mobile number</h2>
          <p className="text-sm text-gray-500 mb-4">
            If you forget your password, we send a reset code by WhatsApp or SMS to this
            number. Without one, resets fall back to email, which may not reach you.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>
          )}
          {done && !error && (
            <div className="bg-teal-50 text-teal-800 text-sm px-4 py-2.5 rounded-lg mb-4">
              {saved ? 'Mobile saved.' : 'Mobile removed.'}
            </div>
          )}

          <label htmlFor="phone" className="label">
            Egyptian mobile
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setDone(false);
            }}
            placeholder="01XXXXXXXXX"
            className="input-field"
          />

          <div className="flex items-center gap-3 mt-4">
            <button type="submit" className="btn-primary" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && (
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50"
                disabled={saving}
                onClick={() => {
                  setPhone('');
                  setDone(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

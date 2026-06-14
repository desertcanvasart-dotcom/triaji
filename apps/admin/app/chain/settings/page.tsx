'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface ChainSettings {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string | null;
  chain_type: string;
  logo_url: string | null;
  main_phone: string | null;
  main_email: string | null;
  website: string | null;
  shared_pricing: boolean;
  shared_patient_records: boolean;
  primary_color: string;
}

export default function ChainSettingsPage() {
  const [chain, setChain] = useState<ChainSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [slug, setSlug] = useState('');
  const [mainPhone, setMainPhone] = useState('');
  const [mainEmail, setMainEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [sharedPricing, setSharedPricing] = useState(true);
  const [sharedRecords, setSharedRecords] = useState(true);
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');

  const getAuthHeaders = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return (token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }) as HeadersInit;
  }, []);

  const fetchChain = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const verifyRes = await fetch('/api/admin/auth/verify', { headers });
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        const chainId = verifyData.chain_id;
        if (chainId) {
          const res = await fetch(`/api/admin/chain/${chainId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            setChain(data);
            setNameAr(data.name_ar ?? '');
            setNameEn(data.name_en ?? '');
            setSlug(data.slug ?? '');
            setMainPhone(data.main_phone ?? '');
            setMainEmail(data.main_email ?? '');
            setWebsite(data.website ?? '');
            setSharedPricing(data.shared_pricing ?? true);
            setSharedRecords(data.shared_patient_records ?? true);
            setPrimaryColor(data.primary_color ?? '#7c3aed');
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchChain();
  }, [fetchChain]);

  async function handleSave() {
    if (!chain) return;
    setSaving(true);
    setMessage('');

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/chain/${chain.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name_ar: nameAr,
          name_en: nameEn || null,
          slug: slug || null,
          main_phone: mainPhone || null,
          main_email: mainEmail || null,
          website: website || null,
          shared_pricing: sharedPricing,
          shared_patient_records: sharedRecords,
          primary_color: primaryColor,
        }),
      });

      if (res.ok) {
        setMessage('Settings saved successfully.');
      } else {
        const data = await res.json();
        setMessage(data.error ?? 'Failed to save.');
      }
    } catch {
      setMessage('An error occurred.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-16" />
        ))}
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No chain found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Chain Settings</h1>

      {message && (
        <div
          className={`px-4 py-2.5 rounded-lg text-sm ${
            message.includes('success')
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">General</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (Arabic)</label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              dir="rtl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            placeholder="my-chain"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={mainPhone}
              onChange={(e) => setMainPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={mainEmail}
              onChange={(e) => setMainEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            placeholder="https://example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <span className="text-sm text-gray-500">{primaryColor}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Shared Settings</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sharedPricing}
            onChange={(e) => setSharedPricing(e.target.checked)}
            className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">Shared Pricing</p>
            <p className="text-xs text-gray-500">
              Use chain-level pricing across all branches (with optional exceptions)
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sharedRecords}
            onChange={(e) => setSharedRecords(e.target.checked)}
            className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">Shared Patient Records</p>
            <p className="text-xs text-gray-500">
              Allow branches to view patient history from other branches in the chain
            </p>
          </div>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 text-white px-6 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

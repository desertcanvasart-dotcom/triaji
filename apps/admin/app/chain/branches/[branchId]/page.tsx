'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface BranchDetail {
  id: string;
  name_ar: string;
  name_en: string | null;
  governorate_id: string | null;
  phone: string | null;
  is_active: boolean;
  tier: string;
  today_patients: number;
  doctor_count: number;
  today_revenue: number;
  created_at: string;
}

export default function BranchDetailPage() {
  const params = useParams();
  const branchId = params.branchId as string;
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chainId, setChainId] = useState<string | null>(null);

  const fetchBranch = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Get admin info to find chain_id
      const verifyRes = await fetch('/api/admin/auth/verify', { headers });
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        const cId = verifyData.chain_id;
        setChainId(cId);

        if (cId) {
          const res = await fetch(`/api/admin/chain/${cId}/branches`, { headers });
          if (res.ok) {
            const data = await res.json();
            const found = (data.branches ?? []).find(
              (b: BranchDetail) => b.id === branchId
            );
            setBranch(found ?? null);
          }
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchBranch();
  }, [fetchBranch]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-48" />
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-32" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Branch Not Found</h2>
          <Link
            href="/chain/branches"
            className="text-violet-600 hover:text-violet-700 text-sm"
          >
            Back to Branches
          </Link>
        </div>
      </div>
    );
  }

  const tierLabel = branch.tier === 'clinic' ? 'Clinic' : branch.tier === 'lab' ? 'Lab' : branch.tier === 'pharmacy' ? 'Pharmacy' : branch.tier;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/chain/branches"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            {'\u2190'}
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{branch.name_ar}</h1>
            {branch.name_en && (
              <p className="text-sm text-gray-500">{branch.name_en}</p>
            )}
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              branch.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {branch.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Today&apos;s Patients</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{branch.today_patients}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Doctors</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">{branch.doctor_count}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Today&apos;s Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {branch.today_revenue.toLocaleString()} EGP
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Tier</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{tierLabel}</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Branch Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branch.phone && (
            <div>
              <dt className="text-xs text-gray-500">Phone</dt>
              <dd className="text-sm font-medium text-gray-900">{branch.phone}</dd>
            </div>
          )}
          {branch.governorate_id && (
            <div>
              <dt className="text-xs text-gray-500">Governorate</dt>
              <dd className="text-sm font-medium text-gray-900">{branch.governorate_id}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500">Created</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(branch.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href={`/chain/branches/${branchId}/staff`}
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-violet-50 hover:border-violet-200 transition-colors"
          >
            <span className="text-xl">{'\u{1F468}\u{200D}\u{2695}\u{FE0F}'}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Staff</p>
              <p className="text-xs text-gray-500">Manage branch staff</p>
            </div>
          </Link>
          <Link
            href={`/chain/branches/${branchId}/settings`}
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-violet-50 hover:border-violet-200 transition-colors"
          >
            <span className="text-xl">{'\u{2699}\u{FE0F}'}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Settings</p>
              <p className="text-xs text-gray-500">Branch configuration</p>
            </div>
          </Link>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
            <span className="text-xl">{'\u{1F517}'}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Branch Admin</p>
              <p className="text-xs text-gray-500">
                Go to /{branch.tier}/dashboard as this branch
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

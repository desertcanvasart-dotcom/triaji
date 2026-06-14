'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface Branch {
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
  status: string;
}

export default function BranchList({ chainId }: { chainId: string }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBranches = useCallback(async () => {
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

      const res = await fetch(`/api/admin/chain/${chainId}/branches`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-48" />
        ))}
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">{'\u{1F3EA}'}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No branches yet</h3>
        <p className="text-gray-500 mb-4">
          Add your first branch to start managing your chain.
        </p>
        <Link
          href="/chain/branches/new"
          className="inline-flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
        >
          + Add Branch
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {branches.map((branch) => (
        <div
          key={branch.id}
          className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  branch.is_active ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <h3 className="font-semibold text-gray-900 truncate">
                {branch.name_ar}
              </h3>
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded">
              {branch.tier}
            </span>
          </div>

          {branch.name_en && (
            <p className="text-sm text-gray-500 mb-3">{branch.name_en}</p>
          )}

          <div className="grid grid-cols-3 gap-3 text-center mb-4 py-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-lg font-bold text-blue-600">
                {branch.today_patients}
              </p>
              <p className="text-xs text-gray-500">Patients</p>
            </div>
            <div>
              <p className="text-lg font-bold text-violet-600">
                {branch.doctor_count}
              </p>
              <p className="text-xs text-gray-500">Doctors</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-600">
                {branch.today_revenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">Revenue</p>
            </div>
          </div>

          {branch.phone && (
            <p className="text-xs text-gray-400 mb-3">{branch.phone}</p>
          )}

          <Link
            href={`/chain/branches/${branch.id}`}
            className="block w-full text-center bg-violet-50 text-violet-700 px-4 py-2 rounded-lg hover:bg-violet-100 transition-colors text-sm font-medium"
          >
            Manage
          </Link>
        </div>
      ))}
    </div>
  );
}

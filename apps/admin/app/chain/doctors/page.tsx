'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface Doctor {
  id: string;
  name_ar: string;
  name_en: string | null;
  specialty: string | null;
  phone: string | null;
  is_active: boolean;
  tenant_id: string;
  branch_assignments: string[];
}

interface Branch {
  id: string;
  name_ar: string;
  name_en: string | null;
}

export default function ChainDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
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

      const verifyRes = await fetch('/api/admin/auth/verify', { headers });
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        const chainId = verifyData.chain_id;
        if (chainId) {
          const res = await fetch(`/api/admin/chain/${chainId}/doctors`, { headers });
          if (res.ok) {
            const data = await res.json();
            setDoctors(data.doctors ?? []);
            setBranches(data.branches ?? []);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const branchMap = branches.reduce(
    (acc, b) => ({ ...acc, [b.id]: b.name_ar }),
    {} as Record<string, string>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-12" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chain Doctors</h1>
        <span className="text-sm text-gray-500">{doctors.length} doctors</span>
      </div>

      {doctors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">No doctors found in any branch.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Specialty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Branches</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{doc.name_ar}</p>
                    {doc.name_en && (
                      <p className="text-xs text-gray-500">{doc.name_en}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.specialty ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {doc.branch_assignments.map((bid) => (
                        <span
                          key={bid}
                          className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded"
                        >
                          {branchMap[bid] ?? bid.slice(0, 8)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        doc.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {doc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

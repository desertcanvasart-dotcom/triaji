'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface Patient {
  registry_id: string;
  patient_id: string;
  name: string | null;
  phone: string | null;
  national_id: string | null;
  gender: string | null;
  total_visits: number;
  first_branch_id: string;
  last_visit_branch_id: string | null;
  last_visit_at: string | null;
}

export default function ChainPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [branches, setBranches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
          const params = new URLSearchParams({
            page: String(page),
            limit: '20',
          });
          if (search) params.set('search', search);

          const res = await fetch(
            `/api/admin/chain/${chainId}/patients?${params}`,
            { headers }
          );
          if (res.ok) {
            const data = await res.json();
            setPatients(data.patients ?? []);
            setBranches(data.branches ?? {});
            setTotalPages(data.pagination?.total_pages ?? 1);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chain Patients</h1>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          type="text"
          placeholder="Search by name, phone, or national ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-16" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">
            {search ? 'No patients match your search.' : 'No patients found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Visits</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Branch</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.registry_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.name ?? 'Unknown'}</p>
                      {p.national_id && (
                        <p className="text-xs text-gray-400">{p.national_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.phone ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-violet-50 text-violet-700 text-xs font-medium px-2 py-0.5 rounded">
                        {p.total_visits}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {p.last_visit_branch_id
                        ? branches[p.last_visit_branch_id] ?? p.last_visit_branch_id.slice(0, 8)
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.last_visit_at
                        ? new Date(p.last_visit_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

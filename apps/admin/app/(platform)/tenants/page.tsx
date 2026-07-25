'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import LoadError from '@/components/ui/LoadError';

interface TenantRow {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  tier: string;
  is_active: boolean;
  created_at: string;
  doctor_count: number;
  bookings_30d: number;
}

const TIER_COLORS: Record<string, string> = {
  platform: 'badge-gold',
  premium: 'badge-teal',
  basic: 'badge-slate',
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (tierFilter) params.set('tier', tierFilter);

      const res = await fetch(`/api/admin/tenants?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setLoadError(data?.error ?? 'Could not load tenants.');
        setTenants([]);
        return;
      }
      setTenants(data.tenants ?? []);
    } catch {
      setLoadError('Could not reach the server.');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [tierFilter]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <Link href="/tenants/new" className="btn-primary">Add Tenant</Link>
      </div>

      <div className="flex gap-3 mb-6">
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="input-field w-48">
          <option value="">All Tiers</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="platform">Platform</option>
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={fetchTenants} />
      ) : tenants.length === 0 ? (
        <EmptyState icon="🏢" title="No tenants" description="Add your first hospital or clinic tenant." actionLabel="Add Tenant" onAction={() => window.location.href = '/tenants/new'} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header px-6 py-3">Name</th>
                  <th className="table-header px-6 py-3">Slug</th>
                  <th className="table-header px-6 py-3">Tier</th>
                  <th className="table-header px-6 py-3">Doctors</th>
                  <th className="table-header px-6 py-3">Bookings (30d)</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/tenants/${t.id}`} className="text-sm font-medium text-teal-600 hover:text-teal-800">
                        {t.name_en}
                      </Link>
                      <p className="text-xs text-gray-500" dir="rtl">{t.name_ar}</p>
                    </td>
                    <td className="table-cell font-mono text-gray-500">{t.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${TIER_COLORS[t.tier] ?? 'badge-gray'}`}>{t.tier}</span>
                    </td>
                    <td className="table-cell">{t.doctor_count}</td>
                    <td className="table-cell">{t.bookings_30d}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${t.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">
                      {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

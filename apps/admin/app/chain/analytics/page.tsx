'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ComparisonEntry {
  branch_id: string;
  branch_name: string;
  branch_name_en: string | null;
  is_active: boolean;
  total_bookings: number;
  completed: number;
  no_shows: number;
  completion_rate: number;
  revenue: number;
  doctor_count: number;
  unique_patients: number;
  avg_wait_minutes: number;
}

export default function ChainAnalyticsPage() {
  const [comparison, setComparison] = useState<ComparisonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

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
          const res = await fetch(
            `/api/admin/chain/${chainId}/analytics/compare?period=${period}`,
            { headers }
          );
          if (res.ok) {
            const data = await res.json();
            setComparison(data.comparison ?? []);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = comparison.map((b) => ({
    name: b.branch_name,
    revenue: b.revenue,
    patients: b.unique_patients,
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-80" />
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics - Branch Comparison</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['week', 'month', 'quarter'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue + Patients Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue &amp; Patient Comparison
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue (EGP)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="patients" name="Unique Patients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comparison Table */}
      {comparison.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Bookings</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Completed</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">No-Shows</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Rate</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Doctors</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Patients</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Avg Wait</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.branch_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          row.is_active ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-medium text-gray-900">{row.branch_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.total_bookings}</td>
                  <td className="px-4 py-3 text-right text-green-600">{row.completed}</td>
                  <td className="px-4 py-3 text-right text-red-600">{row.no_shows}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        row.completion_rate >= 80
                          ? 'bg-green-50 text-green-700'
                          : row.completion_rate >= 60
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {row.completion_rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {row.revenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.doctor_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.unique_patients}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.avg_wait_minutes}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">No branches to compare.</p>
        </div>
      )}
    </div>
  );
}

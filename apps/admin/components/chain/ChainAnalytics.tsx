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
  LineChart,
  Line,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchRevenueCard {
  branch_id: string;
  branch_name: string;
  revenue: number;
  previous_revenue: number;
  pct_change: number;
}

interface PatientsPerBranchWeek {
  week: string;
  [branchName: string]: string | number;
}

interface DoctorPerformance {
  doctor_id: string;
  doctor_name: string;
  branches: string[];
  total_patients: number;
  revenue: number;
  avg_wait_minutes: number;
}

interface PeakHourCell {
  day: number;       // 0=Sun … 6=Sat
  hour: number;      // 0–23
  volume: number;
}

interface BranchComparison {
  branch_id: string;
  branch_name: string;
  is_active: boolean;
  total_patients: number;
  revenue: number;
  avg_wait_minutes: number;
  cancellations: number;
}

interface AnalyticsData {
  branch_revenue: BranchRevenueCard[];
  patients_per_branch_week: PatientsPerBranchWeek[];
  branch_names: string[];
  doctor_performance: DoctorPerformance[];
  peak_hours: PeakHourCell[];
  branch_comparison: BranchComparison[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
);

const BRANCH_COLORS = [
  '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#6366f1', '#14b8a6', '#f97316', '#ec4899',
];

function heatColor(volume: number, max: number): string {
  if (max === 0) return 'bg-gray-50';
  const ratio = volume / max;
  if (ratio > 0.8) return 'bg-violet-600 text-white';
  if (ratio > 0.6) return 'bg-violet-400 text-white';
  if (ratio > 0.4) return 'bg-violet-300';
  if (ratio > 0.2) return 'bg-violet-200';
  if (ratio > 0) return 'bg-violet-100';
  return 'bg-gray-50';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChainAnalytics({ chainId }: { chainId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

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

      const res = await fetch(
        `/api/admin/chain/${chainId}/analytics?period=${period}&full=true`,
        { headers }
      );

      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [chainId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    const setter = format === 'pdf' ? setExportingPdf : setExportingExcel;
    setter(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `/api/admin/chain/${chainId}/analytics/export?period=${period}&format=${format}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chain-analytics-${period}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    } finally {
      setter(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-28" />
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-80" />
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-64" />
      </div>
    );
  }

  const analytics = data ?? {
    branch_revenue: [],
    patients_per_branch_week: [],
    branch_names: [],
    doctor_performance: [],
    peak_hours: [],
    branch_comparison: [],
  };

  const maxHeatVolume = analytics.peak_hours.reduce(
    (max, cell) => Math.max(max, cell.volume),
    0
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Chain Analytics</h1>
        <div className="flex items-center gap-2">
          {/* Period Selector */}
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
          {/* Export Buttons */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={exportingPdf}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {exportingPdf ? '...' : 'Export PDF'}
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exportingExcel}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {exportingExcel ? '...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Per-Branch Revenue Cards with % Change */}
      {analytics.branch_revenue.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {analytics.branch_revenue.map((br, idx) => (
            <div
              key={br.branch_id}
              className="bg-white rounded-xl shadow-sm p-5 border-t-4"
              style={{ borderTopColor: BRANCH_COLORS[idx % BRANCH_COLORS.length] }}
            >
              <p className="text-sm text-gray-500 truncate">{br.branch_name}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {br.revenue.toLocaleString()} <span className="text-sm font-normal text-gray-500">EGP</span>
              </p>
              <div className="flex items-center gap-1 mt-1">
                {br.pct_change >= 0 ? (
                  <span className="text-xs font-medium text-green-600">
                    +{br.pct_change.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-xs font-medium text-red-600">
                    {br.pct_change.toFixed(1)}%
                  </span>
                )}
                <span className="text-xs text-gray-400">vs prev</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stacked Bar Chart: Patients per Branch per Week */}
      {analytics.patients_per_branch_week.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Patients per Branch (Weekly)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.patients_per_branch_week}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {analytics.branch_names.map((name, idx) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="patients"
                  fill={BRANCH_COLORS[idx % BRANCH_COLORS.length]}
                  radius={idx === analytics.branch_names.length - 1 ? [4, 4, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Doctor Performance Table */}
      {analytics.doctor_performance.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Doctor Performance</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Branches</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Patients</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue (EGP)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Avg Wait</th>
              </tr>
            </thead>
            <tbody>
              {analytics.doctor_performance.map((doc) => (
                <tr key={doc.doctor_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{doc.doctor_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {doc.branches.map((b) => (
                        <span
                          key={b}
                          className="text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{doc.total_patients}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {doc.revenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{doc.avg_wait_minutes}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Peak Hours Heatmap */}
      {analytics.peak_hours.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Peak Hours</h2>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="w-12" />
                  {HOUR_LABELS.map((h) => (
                    <th key={h} className="px-1 py-1 text-center text-gray-400 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((dayLabel, dayIdx) => (
                  <tr key={dayLabel}>
                    <td className="text-gray-600 font-medium pr-2 py-0.5">{dayLabel}</td>
                    {Array.from({ length: 24 }, (_, hourIdx) => {
                      const cell = analytics.peak_hours.find(
                        (c) => c.day === dayIdx && c.hour === hourIdx
                      );
                      const vol = cell?.volume ?? 0;
                      return (
                        <td
                          key={hourIdx}
                          className={`w-7 h-7 text-center rounded ${heatColor(vol, maxHeatVolume)}`}
                          title={`${dayLabel} ${HOUR_LABELS[hourIdx]}: ${vol} patients`}
                        >
                          {vol > 0 ? vol : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Branch Comparison Table */}
      {analytics.branch_comparison.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Branch Comparison</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Patients</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue (EGP)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Avg Wait</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cancellations</th>
              </tr>
            </thead>
            <tbody>
              {analytics.branch_comparison.map((br) => (
                <tr key={br.branch_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          br.is_active ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-medium text-gray-900">{br.branch_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {br.total_patients.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {br.revenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{br.avg_wait_minutes}m</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        br.cancellations === 0
                          ? 'bg-green-50 text-green-700'
                          : br.cancellations <= 5
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {br.cancellations}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {analytics.branch_comparison.length === 0 && analytics.branch_revenue.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <span className="text-4xl mb-3 block">&#128202;</span>
          <p className="text-gray-500">No analytics data available for this period.</p>
        </div>
      )}
    </div>
  );
}

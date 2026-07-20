'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { WeeklyBarChart, SimpleLineChart } from '@/components/charts';

interface BranchStat {
  branch_id: string;
  branch_name: string;
  branch_name_en: string | null;
  is_active: boolean;
  today_patients: number;
  doctor_count: number;
  avg_wait_minutes: number;
}

interface RevenueBranch {
  branch_id: string;
  branch_name: string;
  revenue: number;
}

interface NewPatientTrend {
  date: string;
  count: number;
}

interface AnalyticsResponse {
  total_patients: number;
  today_patients: number;
  monthly_revenue: number;
  avg_wait_minutes: number;
  branches: BranchStat[];
  revenue_by_branch: RevenueBranch[];
  new_patients_trend: NewPatientTrend[];
  period: string;
}

export default function ChainDashboard({ chainId }: { chainId: string }) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  const fetchAnalytics = useCallback(async () => {
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
        `/api/admin/chain/${chainId}/analytics?period=${period}`,
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
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-40" />
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-80" />
      </div>
    );
  }

  const analytics = data ?? {
    total_patients: 0,
    today_patients: 0,
    monthly_revenue: 0,
    avg_wait_minutes: 0,
    branches: [],
    revenue_by_branch: [],
    new_patients_trend: [],
    period: 'week',
  };

  const statCards = [
    {
      label: 'Total Patients',
      value: analytics.total_patients.toLocaleString(),
      icon: '\u{1F465}',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: "Today's Patients",
      value: analytics.today_patients.toLocaleString(),
      icon: '\u{1F4C5}',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Revenue (Period)',
      value: `${analytics.monthly_revenue.toLocaleString('en-EG')} EGP`,
      icon: '\u{1F4B0}',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Avg Wait Time',
      value: `${analytics.avg_wait_minutes} min`,
      icon: '\u{23F1}',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const revenueChartData = analytics.revenue_by_branch.map((b) => ({
    name: b.branch_name,
    revenue: b.revenue,
  }));

  const trendChartData = analytics.new_patients_trend.map((t) => ({
    date: t.date.slice(5), // MM-DD
    patients: t.count,
  }));

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chain Dashboard</h1>
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-3"
          >
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center text-lg`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Branch Status Cards */}
      {analytics.branches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Branch Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.branches.map((branch) => (
              <div
                key={branch.branch_id}
                className="bg-white rounded-xl shadow-sm p-5 border-l-4"
                style={{
                  borderLeftColor: branch.is_active ? '#16a34a' : '#dc2626',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {branch.branch_name}
                  </h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      branch.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {branch.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
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
                    <p className="text-lg font-bold text-amber-600">
                      {branch.avg_wait_minutes}m
                    </p>
                    <p className="text-xs text-gray-500">Wait</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Bar Chart */}
      {revenueChartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue by Branch
          </h2>
          <WeeklyBarChart
            data={revenueChartData}
            xTickFontSize={12}
            tooltipFormatter={(value: unknown) => [
              `${Number(value).toLocaleString()} EGP`,
              'Revenue',
            ]}
            bars={[
              { dataKey: 'revenue', name: 'Revenue (EGP)', fill: '#7c3aed', radius: [4, 4, 0, 0] },
            ]}
          />
        </div>
      )}

      {/* New Patients Line Chart */}
      {trendChartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            New Patients Trend
          </h2>
          <SimpleLineChart
            data={trendChartData}
            height={250}
            allowDecimals={false}
            lines={[
              { dataKey: 'patients', name: 'New Patients', stroke: '#7c3aed', dot: { r: 4, fill: '#7c3aed' } },
            ]}
          />
        </div>
      )}
    </div>
  );
}

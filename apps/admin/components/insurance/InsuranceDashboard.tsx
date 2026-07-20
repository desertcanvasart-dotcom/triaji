'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { WeeklyBarChart } from '@/components/charts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeeklyEntry {
  date: string;
  day_name: string;
  submitted: number;
  approved: number;
  rejected: number;
}

interface InsuranceStatsResponse {
  pending_verifications: number;
  pending_preauths: number;
  active_claims: number;
  total_payable_egp: number;
  urgent_preauths: Array<{
    id: string;
    patient_name: string;
    procedure: string;
    sla_deadline: string;
  }>;
  weekly_claims?: WeeklyEntry[];
}

// ─── Day Name Map ────────────────────────────────────────────────────────────

const DAY_NAMES_AR: Record<string, string> = {
  Sunday: 'الأحد',
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slaCountdown(deadline: string): { text: string; color: string } {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: 'متأخر', color: 'text-red-600' };
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours < 2) return { text: `${hours} س ${minutes} د`, color: 'text-red-600' };
  if (hours < 6) return { text: `${hours} س ${minutes} د`, color: 'text-yellow-600' };
  return { text: `${hours} س`, color: 'text-green-600' };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InsuranceDashboard() {
  const [stats, setStats] = useState<InsuranceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
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

      const res = await fetch('/api/admin/insurance/stats', { headers });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-28" />
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-80" />
      </div>
    );
  }

  const data = stats ?? {
    pending_verifications: 0,
    pending_preauths: 0,
    active_claims: 0,
    total_payable_egp: 0,
    urgent_preauths: [],
    weekly_claims: [],
  };

  // ─── Stat Cards ────────────────────────────────────────────────────────────

  const statCards = [
    {
      label: 'تحقق معلق',
      value: data.pending_verifications,
      icon: '🔍',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'موافقات مسبقة',
      value: data.pending_preauths,
      icon: '📋',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'مطالبات نشطة',
      value: data.active_claims,
      icon: '📄',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'إجمالي مستحق',
      value: `${data.total_payable_egp.toLocaleString('ar-EG')} ج.م`,
      icon: '💰',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  // ─── Chart Data ────────────────────────────────────────────────────────────

  const chartData = (data.weekly_claims ?? []).map((d) => ({
    name: DAY_NAMES_AR[d.day_name] ?? d.day_name,
    'مقدمة': d.submitted,
    'موافق عليها': d.approved,
    'مرفوضة': d.rejected,
  }));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir="rtl">
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

      {/* Urgent Pre-Auth Banner */}
      {data.urgent_preauths.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            موافقات مسبقة عاجلة ({data.urgent_preauths.length})
          </h3>
          <div className="space-y-2">
            {data.urgent_preauths.map((pa) => {
              const sla = slaCountdown(pa.sla_deadline);
              return (
                <a
                  key={pa.id}
                  href={`/insurance/pre-auth/${pa.id}`}
                  className="flex items-center justify-between bg-white rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{pa.patient_name}</p>
                    <p className="text-xs text-gray-500">{pa.procedure}</p>
                  </div>
                  <span className={`text-sm font-bold ${sla.color}`}>
                    {sla.text}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Claims Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">مطالبات الأسبوع</h2>
          <WeeklyBarChart
            data={chartData}
            bars={[
              { dataKey: 'مقدمة', fill: '#6366f1', radius: [4, 4, 0, 0] },
              { dataKey: 'موافق عليها', fill: '#16a34a', radius: [4, 4, 0, 0] },
              { dataKey: 'مرفوضة', fill: '#dc2626', radius: [4, 4, 0, 0] },
            ]}
          />
        </div>
      )}
    </div>
  );
}

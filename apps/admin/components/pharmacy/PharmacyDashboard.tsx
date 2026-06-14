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

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyEntry {
  date: string;
  day_name: string;
  prescriptions: number;
  collected: number;
}

interface PharmacyStatsResponse {
  prescriptions_today: number;
  pending: number;
  ready: number;
  collected_today: number;
  daily?: DailyEntry[];
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function PharmacyDashboard({ tenantId }: { tenantId: string }) {
  const [stats, setStats] = useState<PharmacyStatsResponse | null>(null);
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

      const res = await fetch('/api/admin/pharmacy/stats', { headers });
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
    prescriptions_today: 0,
    pending: 0,
    ready: 0,
    collected_today: 0,
    daily: [],
  };

  // ─── Stat Cards ────────────────────────────────────────────────────────────

  const statCards = [
    {
      label: 'الوصفات اليوم',
      value: data.prescriptions_today,
      icon: '💊',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'قيد التحضير',
      value: data.pending,
      icon: '⏳',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'جاهزة للاستلام',
      value: data.ready,
      icon: '✅',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'تم الاستلام',
      value: data.collected_today,
      icon: '📦',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ];

  // ─── Chart Data ────────────────────────────────────────────────────────────

  const chartData = (data.daily ?? []).map((d) => ({
    name: DAY_NAMES_AR[d.day_name] ?? d.day_name,
    وصفات: d.prescriptions,
    'تم الاستلام': d.collected,
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

      {/* Weekly Bar Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">نشاط الأسبوع</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="وصفات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="تم الاستلام" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

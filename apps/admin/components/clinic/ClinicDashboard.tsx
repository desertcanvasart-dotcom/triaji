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

interface DailyEntry {
  date: string;
  day_name: string;
  completed: number;
  no_show: number;
  total: number;
}

interface StatsResponse {
  total_patients: number;
  completed: number;
  no_show: number;
  avg_wait_minutes: number;
  revenue: number;
  daily?: DailyEntry[];
}

const DAY_NAMES_AR: Record<string, string> = {
  Sunday: 'الأحد',
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت',
};

export default function ClinicDashboard({ tenantId }: { tenantId: string }) {
  const [todayStats, setTodayStats] = useState<StatsResponse | null>(null);
  const [weekStats, setWeekStats] = useState<StatsResponse | null>(null);
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

      const [todayRes, weekRes] = await Promise.all([
        fetch(`/api/admin/clinic/stats?period=today`, { headers }),
        fetch(`/api/admin/clinic/stats?period=week`, { headers }),
      ]);

      if (todayRes.ok) setTodayStats(await todayRes.json());
      if (weekRes.ok) setWeekStats(await weekRes.json());
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

  const today = todayStats ?? {
    total_patients: 0,
    completed: 0,
    no_show: 0,
    avg_wait_minutes: 0,
    revenue: 0,
  };

  const week = weekStats ?? {
    total_patients: 0,
    completed: 0,
    no_show: 0,
    avg_wait_minutes: 0,
    revenue: 0,
    daily: [],
  };

  const chartData = (week.daily ?? []).map((d) => ({
    name: DAY_NAMES_AR[d.day_name] ?? d.day_name,
    مكتمل: d.completed,
    'لم يحضر': d.no_show,
  }));

  const statCards = [
    {
      label: 'إجمالي المرضى',
      value: today.total_patients,
      icon: '👥',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'مكتمل',
      value: today.completed,
      icon: '✅',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'لم يحضر',
      value: today.no_show,
      icon: '🚫',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'متوسط انتظار',
      value: `${today.avg_wait_minutes} دق`,
      icon: '⏱',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

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
              <Bar dataKey="مكتمل" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="لم يحضر" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue Summary */}
      {(today.revenue > 0 || week.revenue > 0) && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">الإيرادات</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-xs text-gray-500">إيرادات اليوم</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {today.revenue.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
            <div className="bg-teal-50 rounded-lg p-4">
              <p className="text-xs text-gray-500">إيرادات الأسبوع</p>
              <p className="text-xl font-bold text-teal-700 mt-1">
                {week.revenue.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

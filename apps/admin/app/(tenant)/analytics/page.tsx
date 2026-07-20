'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { VerticalBarChart, SimpleLineChart } from '@/components/charts';

interface FunnelData {
  impression: number;
  button_click: number;
  session_start: number;
  session_complete: number;
  booking_started: number;
  booking_confirmed: number;
}

interface Conversions {
  clickRate: string;
  sessionRate: string;
  completionRate: string;
  bookingRate: string;
}

interface DailySeries {
  date: string;
  impression: number;
  button_click: number;
  session_start: number;
  booking_confirmed: number;
}

interface TopPage {
  url: string;
  count: number;
}

interface AnalyticsData {
  funnel: FunnelData;
  conversions: Conversions;
  dailySeries: DailySeries[];
  topPages: TopPage[];
  totalEvents: number;
}

const FUNNEL_STEPS = [
  { key: 'impression', label: 'Impressions', color: '#94a3b8' },
  { key: 'button_click', label: 'Button Clicks', color: '#0D7A7A' },
  { key: 'session_start', label: 'Session Starts', color: '#0891b2' },
  { key: 'session_complete', label: 'Completed', color: '#059669' },
  { key: 'booking_started', label: 'Booking Started', color: '#d97706' },
  { key: 'booking_confirmed', label: 'Booked', color: '#16a34a' },
] as const;

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/analytics?days=${days}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Widget Analytics</h1>
        <div className="card animate-pulse h-96" />
      </div>
    );
  }

  if (!data || data.totalEvents === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Widget Analytics</h1>
        <div className="card">
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-500 text-sm">
              No widget analytics data yet. Events will appear here once the widget
              is deployed on hospital websites.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Build funnel chart data
  const funnelChartData = FUNNEL_STEPS.map((step) => ({
    name: step.label,
    value: data.funnel[step.key as keyof FunnelData],
    fill: step.color,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Widget Analytics</h1>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                days === d
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Conversion Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Click Rate</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{data.conversions.clickRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Impression → Click</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Session Rate</p>
          <p className="text-2xl font-bold text-cyan-600 mt-1">{data.conversions.sessionRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Click → Session</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Completion Rate</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{data.conversions.completionRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Session → Complete</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Booking Rate</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{data.conversions.bookingRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Complete → Booked</p>
        </div>
      </div>

      {/* Funnel Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Funnel</h2>
        <VerticalBarChart data={funnelChartData} />
      </div>

      {/* Daily Time Series */}
      {data.dailySeries.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity</h2>
          <SimpleLineChart
            data={data.dailySeries}
            xTickFontSize={11}
            xTickFormatter={(v: string) => v.slice(5)}
            legend
            lines={[
              { dataKey: 'impression', name: 'Impressions', stroke: '#94a3b8' },
              { dataKey: 'button_click', name: 'Clicks', stroke: '#0D7A7A' },
              { dataKey: 'session_start', name: 'Sessions', stroke: '#0891b2' },
              { dataKey: 'booking_confirmed', name: 'Bookings', stroke: '#16a34a' },
            ]}
          />
        </div>
      )}

      {/* Top Pages */}
      {data.topPages.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h2>
          <div className="space-y-3">
            {data.topPages.map((page, i) => {
              const maxCount = data.topPages[0]?.count ?? 1;
              const pct = (page.count / maxCount) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 truncate max-w-[80%]" title={page.url}>
                      {page.url}
                    </span>
                    <span className="text-gray-900 font-medium">{page.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="card bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Total events: {data.totalEvents}</span>
          <span>·</span>
          <span>Last {days} days</span>
        </div>
      </div>
    </div>
  );
}

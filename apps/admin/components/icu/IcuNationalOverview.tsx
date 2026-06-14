'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RegionData {
  region: string;
  totalBeds: number;
  availableBeds: number;
  occupancyPct: number;
}

interface UnitTypeData {
  unitType: string;
  totalBeds: number;
  availableBeds: number;
}

interface OverviewData {
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  occupancyPct: number;
  byRegion: RegionData[];
  byUnitType: UnitTypeData[];
  recentTransfers: number;
}

// ─── Unit type labels ───────────────────────────────────────────────────────

const UNIT_TYPE_LABELS: Record<string, string> = {
  general_icu: 'General ICU',
  cardiac_icu: 'Cardiac ICU (CCU)',
  neonatal_icu: 'Neonatal ICU (NICU)',
  pediatric_icu: 'Pediatric ICU (PICU)',
  surgical_icu: 'Surgical ICU (SICU)',
  burn_icu: 'Burn ICU',
  neuro_icu: 'Neuro ICU',
  trauma_icu: 'Trauma ICU',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function occupancyColor(pct: number): string {
  if (pct > 85) return 'text-red-600';
  if (pct >= 70) return 'text-amber-600';
  return 'text-green-600';
}

function statusBadge(pct: number): { label: string; className: string } {
  if (pct > 85) return { label: 'Critical', className: 'bg-red-100 text-red-700' };
  if (pct >= 70) return { label: 'Warning', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Normal', className: 'bg-green-100 text-green-700' };
}

function occupancyBarColor(pct: number): string {
  if (pct > 85) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-green-500';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IcuNationalOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/icu/overview');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to load ICU overview');
        return;
      }
      const result: OverviewData = await res.json();
      setData(result);
      setError(null);
    } catch {
      setError('Failed to load ICU overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Supabase Realtime: re-fetch on icu_units changes ──
  useEffect(() => {
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel('icu-national-overview')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'icu_units' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* ── Top Stats Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Beds Registered"
          value={data.totalBeds}
          icon="🛏️"
        />
        <StatCard
          label="Available Now"
          value={data.availableBeds}
          icon="✅"
          valueClassName="text-green-600"
        />
        <StatCard
          label="Occupancy"
          value={`${data.occupancyPct}%`}
          icon="📊"
          valueClassName={occupancyColor(data.occupancyPct)}
        />
        <StatCard
          label="Transfers (24h)"
          value={data.recentTransfers}
          icon="🚑"
        />
      </div>

      {/* ── Regional Breakdown Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Regional Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 font-semibold text-gray-700">
                  Region
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">
                  Total Beds
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">
                  Available
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">
                  Occupancy %
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byRegion.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No ICU units registered yet
                  </td>
                </tr>
              ) : (
                data.byRegion.map((region) => {
                  const badge = statusBadge(region.occupancyPct);
                  return (
                    <tr
                      key={region.region}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {region.region}
                      </td>
                      <td className="px-6 py-3 text-gray-700">
                        {region.totalBeds}
                      </td>
                      <td className="px-6 py-3 text-gray-700">
                        {region.availableBeds}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${occupancyBarColor(region.occupancyPct)}`}
                              style={{ width: `${Math.min(region.occupancyPct, 100)}%` }}
                            />
                          </div>
                          <span className={`font-medium ${occupancyColor(region.occupancyPct)}`}>
                            {region.occupancyPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Unit Type Breakdown ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Availability by Unit Type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.byUnitType.length === 0 ? (
            <p className="text-gray-400 col-span-full text-center py-8">
              No unit types registered
            </p>
          ) : (
            data.byUnitType.map((ut) => {
              const occupied = ut.totalBeds - ut.availableBeds;
              const pct =
                ut.totalBeds > 0
                  ? Math.round((occupied / ut.totalBeds) * 100)
                  : 0;
              return (
                <div
                  key={ut.unitType}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <p className="text-sm font-medium text-gray-500">
                    {UNIT_TYPE_LABELS[ut.unitType] ?? ut.unitType}
                  </p>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-bold text-green-600">
                        {ut.availableBeds}
                      </span>
                      <span className="text-sm text-gray-400 ml-1">
                        / {ut.totalBeds}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${occupancyColor(pct)}`}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${occupancyBarColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  valueClassName = 'text-gray-900',
}: {
  label: string;
  value: number | string;
  icon: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`mt-2 text-3xl font-bold ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

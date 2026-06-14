'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { ClaimStatus } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProviderInsuranceDashboardProps {
  tenantId: string;
}

interface ProviderInsuranceStats {
  claims_submitted: number;
  claims_approved: number;
  claims_rejected: number;
  total_payable_egp: number;
  approaching_deadlines: Array<{
    id: string;
    claim_number: string;
    patient_name: string;
    submission_deadline: string;
    total_amount_egp: number;
  }>;
}

interface ProviderClaim {
  id: string;
  claim_number: string;
  patient_name: string;
  insurer_name: string;
  claim_type: string;
  total_amount_egp: number;
  claimed_amount_egp: number;
  approved_amount_egp: number | null;
  status: ClaimStatus;
  submitted_at: string | null;
  submission_deadline: string | null;
}

type FilterStatus = 'all' | 'draft' | 'submitted' | 'approved' | 'rejected';

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_BADGES: Record<ClaimStatus, { label: string; className: string }> = {
  draft: { label: 'مسودة', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  submitted: { label: 'مقدمة', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  under_review: { label: 'قيد المراجعة', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  approved: { label: 'موافق عليها', className: 'bg-green-100 text-green-700 border-green-200' },
  approved_partial: { label: 'موافق جزئياً', className: 'bg-lime-100 text-lime-700 border-lime-200' },
  paid: { label: 'تم الدفع', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'مرفوضة', className: 'bg-red-100 text-red-700 border-red-200' },
  appealed: { label: 'طعن', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  closed: { label: 'مغلقة', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  consultation: 'كشف',
  lab_test: 'تحاليل',
  imaging: 'أشعة',
  medication: 'أدوية',
  procedure: 'إجراء',
  hospitalization: 'إقامة',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProviderInsuranceDashboard({ tenantId }: ProviderInsuranceDashboardProps) {
  const [stats, setStats] = useState<ProviderInsuranceStats | null>(null);
  const [claims, setClaims] = useState<ProviderClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const [statsRes, claimsRes] = await Promise.all([
        fetch('/api/admin/insurance/provider/stats', { headers }),
        fetch(`/api/admin/insurance/provider/claims?${params.toString()}`, { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (claimsRes.ok) {
        const data = await claimsRes.json();
        setClaims(data.claims ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter, getAuthHeaders]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading && !stats) {
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
    claims_submitted: 0,
    claims_approved: 0,
    claims_rejected: 0,
    total_payable_egp: 0,
    approaching_deadlines: [],
  };

  // ─── Stat Cards ────────────────────────────────────────────────────────

  const statCards = [
    {
      label: 'مطالبات مقدمة',
      value: data.claims_submitted,
      icon: '📋',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'موافق عليها',
      value: data.claims_approved,
      icon: '✅',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'مرفوضة',
      value: data.claims_rejected,
      icon: '❌',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'إجمالي مستحق',
      value: `${data.total_payable_egp.toLocaleString('ar-EG')} ج.م`,
      icon: '💰',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  // ─── Filter Tabs ─────────────────────────────────────────────────────────

  const filters: Array<{ value: FilterStatus; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'draft', label: 'مسودة' },
    { value: 'submitted', label: 'مقدمة' },
    { value: 'approved', label: 'موافق عليها' },
    { value: 'rejected', label: 'مرفوضة' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

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

      {/* Deadline Warning Banner */}
      {data.approaching_deadlines.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            مواعيد تقديم قريبة ({data.approaching_deadlines.length})
          </h3>
          <div className="space-y-2">
            {data.approaching_deadlines.map((d) => {
              const days = daysUntil(d.submission_deadline);
              const dayColor = days <= 3 ? 'text-red-600' : days <= 7 ? 'text-yellow-600' : 'text-green-600';
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-white rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{d.patient_name}</p>
                    <p className="text-xs text-gray-500">
                      {d.claim_number} — {d.total_amount_egp.toLocaleString('ar-EG')} ج.م
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${dayColor}`}>
                    {days <= 0 ? 'متأخر!' : `${days} يوم`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <a
          href="/clinic/billing/insurance/create-claim"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          إنشاء مطالبة من فاتورة
        </a>
        <a
          href="/clinic/billing/insurance/bulk-import"
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          استيراد من الفواتير
        </a>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Claims Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm text-center py-16">
          <span className="text-4xl mb-3 block">📄</span>
          <p className="text-gray-500 text-sm">لا توجد مطالبات</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">رقم المطالبة</th>
                  <th className="text-right px-4 py-3 font-medium">المريض</th>
                  <th className="text-right px-4 py-3 font-medium">شركة التأمين</th>
                  <th className="text-right px-4 py-3 font-medium">النوع</th>
                  <th className="text-right px-4 py-3 font-medium">المبلغ</th>
                  <th className="text-right px-4 py-3 font-medium">الموافق</th>
                  <th className="text-right px-4 py-3 font-medium">الحالة</th>
                  <th className="text-right px-4 py-3 font-medium">الموعد النهائي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((claim) => {
                  const badge = STATUS_BADGES[claim.status] ?? STATUS_BADGES.draft;
                  const deadlineDays = claim.submission_deadline ? daysUntil(claim.submission_deadline) : null;
                  const deadlineColor =
                    deadlineDays != null
                      ? deadlineDays <= 3
                        ? 'text-red-600'
                        : deadlineDays <= 7
                          ? 'text-yellow-600'
                          : 'text-gray-500'
                      : '';

                  return (
                    <tr key={claim.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{claim.claim_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{claim.patient_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{claim.insurer_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {CLAIM_TYPE_LABELS[claim.claim_type] ?? claim.claim_type}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {claim.claimed_amount_egp.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-green-700">
                        {claim.approved_amount_egp != null
                          ? `${claim.approved_amount_egp.toLocaleString('ar-EG')} ج.م`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {claim.submission_deadline ? (
                          <span className={`text-xs font-medium ${deadlineColor}`}>
                            {formatDate(claim.submission_deadline)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { ClaimStatus } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClaimRow {
  id: string;
  claim_number: string;
  patient_name: string;
  provider_name: string | null;
  claim_type: string;
  claimed_amount_egp: number;
  status: ClaimStatus;
  submitted_at: string | null;
}

type FilterStatus = 'all' | 'submitted' | 'under_review' | 'approved' | 'rejected';

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClaimsQueue() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const fetchClaims = useCallback(async () => {
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

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/insurance/claims?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchClaims();
    const interval = setInterval(fetchClaims, 30000);
    return () => clearInterval(interval);
  }, [fetchClaims]);

  // ─── Filter Tabs ─────────────────────────────────────────────────────────

  const filters: Array<{ value: FilterStatus; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'submitted', label: 'مقدمة' },
    { value: 'under_review', label: 'قيد المراجعة' },
    { value: 'approved', label: 'موافق عليها' },
    { value: 'rejected', label: 'مرفوضة' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" dir="rtl">
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

      {/* Table */}
      <div className="space-y-3">
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
                    <th className="text-right px-4 py-3 font-medium">مقدم الخدمة</th>
                    <th className="text-right px-4 py-3 font-medium">النوع</th>
                    <th className="text-right px-4 py-3 font-medium">المبلغ</th>
                    <th className="text-right px-4 py-3 font-medium">الحالة</th>
                    <th className="text-right px-4 py-3 font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {claims.map((claim) => {
                    const badge = STATUS_BADGES[claim.status] ?? { label: 'مقدمة', className: 'bg-blue-100 text-blue-700' };
                    return (
                      <tr key={claim.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{claim.claim_number}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{claim.patient_name}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{claim.provider_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {CLAIM_TYPE_LABELS[claim.claim_type] ?? claim.claim_type}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {claim.claimed_amount_egp.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`/insurance/claims/${claim.id}`}
                            className="text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                          >
                            التفاصيل
                          </a>
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
    </div>
  );
}

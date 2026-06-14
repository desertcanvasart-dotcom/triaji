'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { PreauthStatus } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreAuthRow {
  id: string;
  patient_name: string;
  procedure_description_ar: string;
  doctor_name: string | null;
  estimated_cost_egp: number | null;
  urgency: string;
  status: PreauthStatus;
  submitted_at: string;
  sla_deadline: string | null;
}

type FilterStatus = 'all' | 'submitted' | 'under_review' | 'approved' | 'denied';

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_BADGES: Record<PreauthStatus, { label: string; className: string }> = {
  submitted: { label: 'مقدم', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  under_review: { label: 'قيد المراجعة', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  approved: { label: 'موافق', className: 'bg-green-100 text-green-700 border-green-200' },
  approved_partial: { label: 'موافق جزئياً', className: 'bg-lime-100 text-lime-700 border-lime-200' },
  denied: { label: 'مرفوض', className: 'bg-red-100 text-red-700 border-red-200' },
  expired: { label: 'منتهي', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  cancelled: { label: 'ملغي', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const URGENCY_BADGES: Record<string, { label: string; className: string }> = {
  routine: { label: 'عادي', className: 'bg-gray-100 text-gray-600' },
  urgent: { label: 'عاجل', className: 'bg-orange-100 text-orange-700' },
  emergency: { label: 'طوارئ', className: 'bg-red-100 text-red-700' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slaTimer(deadline: string | null): { text: string; color: string } | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: 'متأخر', color: 'text-red-600 bg-red-50' };
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours < 2) return { text: `${hours}:${String(minutes).padStart(2, '0')}`, color: 'text-red-600 bg-red-50' };
  if (hours < 6) return { text: `${hours}:${String(minutes).padStart(2, '0')}`, color: 'text-yellow-600 bg-yellow-50' };
  return { text: `${hours} س`, color: 'text-green-600 bg-green-50' };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PreAuthQueue() {
  const [requests, setRequests] = useState<PreAuthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [, setTick] = useState(0);

  const fetchRequests = useCallback(async () => {
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

      const res = await fetch(`/api/admin/insurance/preauth?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  // Tick every minute to update SLA timers
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(tickRef.current);
  }, []);

  // ─── Filter Tabs ─────────────────────────────────────────────────────────

  const filters: Array<{ value: FilterStatus; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'submitted', label: 'مقدم' },
    { value: 'under_review', label: 'قيد المراجعة' },
    { value: 'approved', label: 'موافق' },
    { value: 'denied', label: 'مرفوض' },
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

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-16">
            <span className="text-4xl mb-3 block">📋</span>
            <p className="text-gray-500 text-sm">لا توجد طلبات موافقة مسبقة</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-right px-4 py-3 font-medium">المريض</th>
                    <th className="text-right px-4 py-3 font-medium">الإجراء</th>
                    <th className="text-right px-4 py-3 font-medium">الطبيب</th>
                    <th className="text-right px-4 py-3 font-medium">التكلفة</th>
                    <th className="text-right px-4 py-3 font-medium">الأولوية</th>
                    <th className="text-right px-4 py-3 font-medium">SLA</th>
                    <th className="text-right px-4 py-3 font-medium">الحالة</th>
                    <th className="text-right px-4 py-3 font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((req) => {
                    const badge = STATUS_BADGES[req.status] ?? STATUS_BADGES.submitted;
                    const urgencyBadge = URGENCY_BADGES[req.urgency] ?? { label: 'روتيني', className: 'bg-gray-100 text-gray-600' };
                    const sla = slaTimer(req.sla_deadline);

                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{req.patient_name}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate">
                          {req.procedure_description_ar}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{req.doctor_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                          {req.estimated_cost_egp ? `${req.estimated_cost_egp.toLocaleString('ar-EG')} ج.م` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgencyBadge.className}`}>
                            {urgencyBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sla ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sla.color}`}>
                              {sla.text}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`/insurance/pre-auth/${req.id}`}
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

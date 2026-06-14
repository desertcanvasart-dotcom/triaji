'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type PrescriptionStatus = 'routed' | 'received' | 'checking_stock' | 'ready' | 'partial_ready' | 'collected';

interface PrescriptionItem {
  id: string;
  routing_id: string;
  patient_name: string;
  doctor_name: string;
  medication_count: number;
  has_insurance: boolean;
  status: PrescriptionStatus;
  routed_at: string;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_BADGES: Record<PrescriptionStatus, { label: string; className: string }> = {
  routed: { label: 'جديدة', className: 'bg-red-100 text-red-700 border-red-200' },
  received: { label: 'مستلمة', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  checking_stock: { label: 'قيد الفحص', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  ready: { label: 'جاهزة', className: 'bg-green-100 text-green-700 border-green-200' },
  partial_ready: { label: 'جاهزة جزئياً', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  collected: { label: 'تم الاستلام', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PrescriptionsList({ tenantId }: { tenantId: string }) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | PrescriptionStatus>('all');

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/pharmacy/prescriptions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPrescriptions(data.prescriptions ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPrescriptions();
    // Poll every 30 seconds for new prescriptions
    const interval = setInterval(fetchPrescriptions, 30000);
    return () => clearInterval(interval);
  }, [fetchPrescriptions]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const filters: Array<{ value: 'all' | PrescriptionStatus; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'routed', label: 'جديدة' },
    { value: 'checking_stock', label: 'قيد الفحص' },
    { value: 'ready', label: 'جاهزة' },
    { value: 'collected', label: 'تم الاستلام' },
  ];

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

      {/* Prescriptions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-16">
            <span className="text-4xl mb-3 block">💊</span>
            <p className="text-gray-500 text-sm">لا توجد وصفات</p>
          </div>
        ) : (
          prescriptions.map((rx) => {
            const badge = STATUS_BADGES[rx.status] ?? STATUS_BADGES.routed;

            return (
              <a
                key={rx.id}
                href={`/pharmacy/prescriptions/${rx.routing_id}`}
                className="block bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{rx.patient_name}</p>
                    <p className="text-sm text-gray-500">د. {rx.doctor_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        {rx.medication_count} أدوية
                      </span>
                      {rx.has_insurance && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                          تأمين
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {timeAgo(rx.routed_at)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

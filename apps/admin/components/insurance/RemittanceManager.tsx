'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RemittanceRow {
  id: string;
  remittance_number: string;
  provider_name: string;
  period_start: string;
  period_end: string;
  total_claims: number;
  total_amount_egp: number;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
}

interface ProviderOption {
  tenant_id: string;
  name: string;
}

interface UnpaidClaim {
  id: string;
  claim_number: string;
  patient_name: string;
  claimed_amount_egp: number;
  approved_amount_egp: number;
  submitted_at: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'مسودة', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  issued: { label: 'صادرة', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  paid: { label: 'تم الدفع', className: 'bg-green-100 text-green-700 border-green-200' },
  cancelled: { label: 'ملغاة', className: 'bg-red-100 text-red-700 border-red-200' },
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

export default function RemittanceManager() {
  const [remittances, setRemittances] = useState<RemittanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [unpaidClaims, setUnpaidClaims] = useState<UnpaidClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [saving, setSaving] = useState(false);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRemittances = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/insurance/remittance', { headers });
      if (res.ok) {
        const data = await res.json();
        setRemittances(data.remittances ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchProviders = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/insurance/remittance/providers', { headers });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers ?? []);
      }
    } catch {
      // Silently fail
    }
  }, [getAuthHeaders]);

  const fetchUnpaidClaims = useCallback(async () => {
    if (!selectedProvider || !periodStart || !periodEnd) {
      setUnpaidClaims([]);
      return;
    }
    setLoadingClaims(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        provider_tenant_id: selectedProvider,
        period_start: periodStart,
        period_end: periodEnd,
      });
      const res = await fetch(`/api/admin/insurance/remittance/unpaid-claims?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUnpaidClaims(data.claims ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingClaims(false);
    }
  }, [selectedProvider, periodStart, periodEnd, getAuthHeaders]);

  useEffect(() => {
    fetchRemittances();
    fetchProviders();
  }, [fetchRemittances, fetchProviders]);

  useEffect(() => {
    if (showCreateForm) {
      fetchUnpaidClaims();
    }
  }, [showCreateForm, fetchUnpaidClaims]);

  const totalAmount = unpaidClaims.reduce((sum, c) => sum + (c.approved_amount_egp ?? 0), 0);

  const handleCreateRemittance = async () => {
    if (!selectedProvider || unpaidClaims.length === 0) return;
    setSaving(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      };

      const res = await fetch('/api/admin/insurance/remittance', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider_tenant_id: selectedProvider,
          period_start: periodStart,
          period_end: periodEnd,
          claim_ids: unpaidClaims.map((c) => c.id),
          total_amount_egp: totalAmount,
        }),
      });

      if (res.ok) {
        setShowCreateForm(false);
        setSelectedProvider('');
        setPeriodStart('');
        setPeriodEnd('');
        setUnpaidClaims([]);
        fetchRemittances();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header + Create Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">التسويات المالية</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          {showCreateForm ? 'إلغاء' : 'إنشاء دفعة جديدة'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">إنشاء تسوية مالية جديدة</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-xs text-gray-600 mb-1">مقدم الخدمة</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">اختر مقدم الخدمة</option>
                {providers.map((p) => (
                  <option key={p.tenant_id} value={p.tenant_id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">من تاريخ</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Unpaid Claims Table */}
          {loadingClaims ? (
            <div className="bg-gray-50 rounded-lg p-5 animate-pulse h-32" />
          ) : unpaidClaims.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-right px-4 py-2 font-medium">رقم المطالبة</th>
                    <th className="text-right px-4 py-2 font-medium">المريض</th>
                    <th className="text-right px-4 py-2 font-medium">المبلغ الموافق</th>
                    <th className="text-right px-4 py-2 font-medium">تاريخ التقديم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unpaidClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">{claim.claim_number}</td>
                      <td className="px-4 py-2 text-gray-900">{claim.patient_name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-green-700">
                        {claim.approved_amount_egp.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="px-4 py-2 text-gray-500">{formatDate(claim.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedProvider && periodStart && periodEnd ? (
            <div className="bg-gray-50 rounded-lg p-5 text-center text-gray-400 text-sm mb-4">
              لا توجد مطالبات غير مدفوعة في هذه الفترة
            </div>
          ) : null}

          {/* Total & Submit */}
          {unpaidClaims.length > 0 && (
            <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-4">
              <div>
                <p className="text-sm text-gray-600">
                  {unpaidClaims.length} مطالبة
                </p>
                <p className="text-xl font-bold text-emerald-700">
                  {totalAmount.toLocaleString('ar-EG')} ج.م
                </p>
              </div>
              <button
                onClick={handleCreateRemittance}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'جاري الإنشاء...' : 'إصدار التسوية'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Existing Remittances Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : remittances.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm text-center py-16">
          <span className="text-4xl mb-3 block">💳</span>
          <p className="text-gray-500 text-sm">لا توجد تسويات مالية بعد</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">رقم التسوية</th>
                  <th className="text-right px-4 py-3 font-medium">مقدم الخدمة</th>
                  <th className="text-right px-4 py-3 font-medium">الفترة</th>
                  <th className="text-right px-4 py-3 font-medium">عدد المطالبات</th>
                  <th className="text-right px-4 py-3 font-medium">المبلغ</th>
                  <th className="text-right px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {remittances.map((r) => {
                  const badge = STATUS_BADGES[r.status] ?? { label: 'مسودة', className: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.remittance_number}</td>
                      <td className="px-4 py-3 text-gray-900">{r.provider_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(r.period_start)} — {formatDate(r.period_end)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.total_claims}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {r.total_amount_egp.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
                          {badge.label}
                        </span>
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

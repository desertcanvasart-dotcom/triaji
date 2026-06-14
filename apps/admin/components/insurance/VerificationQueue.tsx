'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { PolicyStatus } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PolicyRow {
  id: string;
  patient_name: string;
  policy_number: string;
  card_number: string | null;
  card_image_url: string | null;
  insurer_code: string;
  submitted_at: string;
  status: PolicyStatus;
}

interface VerifyFormState {
  status: 'active' | 'expired' | 'suspended';
  annual_limit_egp: string;
  copay_pct: string;
  coverage_end: string;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_BADGES: Record<PolicyStatus, { label: string; className: string }> = {
  pending_verification: { label: 'بانتظار التحقق', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  unverified: { label: 'غير متحقق', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  active: { label: 'فعالة', className: 'bg-green-100 text-green-700 border-green-200' },
  expired: { label: 'منتهية', className: 'bg-red-100 text-red-700 border-red-200' },
  suspended: { label: 'موقوفة', className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VerificationQueue() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VerifyFormState>({
    status: 'active',
    annual_limit_egp: '',
    copay_pct: '',
    coverage_end: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchPolicies = useCallback(async () => {
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

      const res = await fetch('/api/admin/insurance/verifications?status=pending_verification', { headers });
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
    const interval = setInterval(fetchPolicies, 30000);
    return () => clearInterval(interval);
  }, [fetchPolicies]);

  const startVerify = (policy: PolicyRow) => {
    setEditingId(policy.id);
    setForm({
      status: 'active',
      annual_limit_egp: '',
      copay_pct: '',
      coverage_end: '',
    });
  };

  const handleVerify = async (policyId: string) => {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`/api/admin/insurance/verifications/${policyId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: form.status,
          annual_limit_egp: form.annual_limit_egp ? Number(form.annual_limit_egp) : null,
          copay_pct: form.copay_pct ? Number(form.copay_pct) : null,
          coverage_end: form.coverage_end || null,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        fetchPolicies();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm text-center py-16">
        <span className="text-4xl mb-3 block">✅</span>
        <p className="text-gray-500 text-sm">لا توجد بوليصات بانتظار التحقق</p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" dir="rtl">
      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-right px-4 py-3 font-medium">المريض</th>
                <th className="text-right px-4 py-3 font-medium">رقم البوليصة</th>
                <th className="text-right px-4 py-3 font-medium">تاريخ التقديم</th>
                <th className="text-right px-4 py-3 font-medium">صورة الكارت</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {policies.map((policy) => {
                const badge = STATUS_BADGES[policy.status] ?? STATUS_BADGES.pending_verification;
                const isEditing = editingId === policy.id;

                return (
                  <tr key={policy.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{policy.patient_name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{policy.policy_number}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(policy.submitted_at)}</td>
                    <td className="px-4 py-3">
                      {policy.card_image_url ? (
                        <a
                          href={policy.card_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          عرض الصورة
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">لا توجد</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isEditing ? (
                        <button
                          onClick={() => startVerify(policy)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                          تحقق
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-500 text-xs hover:text-gray-700"
                        >
                          إلغاء
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Verify Form */}
      {editingId && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">نموذج التحقق</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">الحالة</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as VerifyFormState['status'] })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="active">فعالة</option>
                <option value="expired">منتهية</option>
                <option value="suspended">موقوفة</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">الحد السنوي (ج.م)</label>
              <input
                type="number"
                value={form.annual_limit_egp}
                onChange={(e) => setForm({ ...form, annual_limit_egp: e.target.value })}
                placeholder="50000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">نسبة التحمل %</label>
              <input
                type="number"
                value={form.copay_pct}
                onChange={(e) => setForm({ ...form, copay_pct: e.target.value })}
                placeholder="20"
                min="0"
                max="100"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">تاريخ انتهاء التغطية</label>
              <input
                type="date"
                value={form.coverage_end}
                onChange={(e) => setForm({ ...form, coverage_end: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => handleVerify(editingId)}
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ التحقق'}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

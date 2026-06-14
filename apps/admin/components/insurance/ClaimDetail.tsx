'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { ClaimStatus, ClaimType, ClaimLineItem } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClaimFull {
  id: string;
  claim_number: string;
  claim_type: ClaimType;
  patient_name: string;
  patient_phone: string | null;
  policy_number: string;
  insurer_name: string;
  provider_name: string | null;
  provider_type: string;
  doctor_name: string | null;
  total_amount_egp: number;
  claimed_amount_egp: number;
  approved_amount_egp: number | null;
  patient_copay_egp: number | null;
  provider_receives_egp: number | null;
  line_items: ClaimLineItem[];
  status: ClaimStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason_ar: string | null;
  rejection_code: string | null;
  preauth_reference: string | null;
  submission_deadline: string | null;
}

type DecisionType = 'approve' | 'approve_partial' | 'reject';

interface DecisionForm {
  decision: DecisionType;
  approved_amount_egp: string;
  notes_ar: string;
  rejection_reason_ar: string;
  rejection_code: string;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_BADGES: Record<ClaimStatus, { label: string; className: string }> = {
  draft: { label: 'مسودة', className: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'مقدمة', className: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'قيد المراجعة', className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'موافق عليها', className: 'bg-green-100 text-green-700' },
  approved_partial: { label: 'موافق جزئياً', className: 'bg-lime-100 text-lime-700' },
  paid: { label: 'تم الدفع', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'مرفوضة', className: 'bg-red-100 text-red-700' },
  appealed: { label: 'طعن', className: 'bg-purple-100 text-purple-700' },
  closed: { label: 'مغلقة', className: 'bg-gray-100 text-gray-500' },
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  consultation: 'كشف',
  lab_test: 'تحاليل',
  imaging: 'أشعة',
  medication: 'أدوية',
  procedure: 'إجراء',
  hospitalization: 'إقامة',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClaimDetail({ claimId }: { claimId: string }) {
  const [detail, setDetail] = useState<ClaimFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DecisionForm>({
    decision: 'approve',
    approved_amount_egp: '',
    notes_ar: '',
    rejection_reason_ar: '',
    rejection_code: '',
  });

  const fetchDetail = useCallback(async () => {
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

      const res = await fetch(`/api/admin/insurance/claims/${claimId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDetail(data.claim ?? data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDecision = async () => {
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

      const body: Record<string, unknown> = { decision: form.decision };

      if (form.decision === 'approve' || form.decision === 'approve_partial') {
        body.approved_amount_egp = form.approved_amount_egp ? Number(form.approved_amount_egp) : null;
        body.notes_ar = form.notes_ar || null;
      } else {
        body.rejection_reason_ar = form.rejection_reason_ar || null;
        body.rejection_code = form.rejection_code || null;
      }

      const res = await fetch(`/api/admin/insurance/claims/${claimId}/decide`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowDecisionForm(false);
        fetchDetail();
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
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse h-48" />
        <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse h-64" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-white rounded-xl shadow-sm text-center py-16">
        <span className="text-4xl mb-3 block">❌</span>
        <p className="text-gray-500 text-sm">لم يتم العثور على المطالبة</p>
      </div>
    );
  }

  const badge = STATUS_BADGES[detail.status] ?? { label: 'مقدمة', className: 'bg-blue-100 text-blue-700' };
  const canDecide = detail.status === 'submitted' || detail.status === 'under_review';

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <a
          href="/insurance/claims"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← العودة للقائمة
        </a>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-gray-500">{detail.claim_number}</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Claim Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">ملخص المطالبة</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">المريض</p>
            <p className="font-medium text-gray-900">{detail.patient_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">مقدم الخدمة</p>
            <p className="text-gray-700">{detail.provider_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">الطبيب</p>
            <p className="text-gray-700">{detail.doctor_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">النوع</p>
            <p className="text-gray-700">{CLAIM_TYPE_LABELS[detail.claim_type] ?? detail.claim_type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">رقم البوليصة</p>
            <p className="font-mono text-sm text-gray-700">{detail.policy_number}</p>
          </div>
          {detail.preauth_reference && (
            <div>
              <p className="text-xs text-gray-500">رقم الموافقة المسبقة</p>
              <p className="font-mono text-sm text-gray-700">{detail.preauth_reference}</p>
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">البيانات المالية</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">إجمالي الفاتورة</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {detail.total_amount_egp.toLocaleString('ar-EG')} ج.م
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">المبلغ المطالب</p>
            <p className="text-xl font-bold text-blue-700 mt-1">
              {detail.claimed_amount_egp.toLocaleString('ar-EG')} ج.م
            </p>
          </div>
          {detail.approved_amount_egp != null && (
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-gray-500">المبلغ الموافق</p>
              <p className="text-xl font-bold text-green-700 mt-1">
                {detail.approved_amount_egp.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
          )}
          {detail.patient_copay_egp != null && (
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-xs text-gray-500">تحمل المريض</p>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {detail.patient_copay_egp.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      {detail.line_items && detail.line_items.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">بنود المطالبة</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-right px-4 py-2 font-medium">البند</th>
                  <th className="text-right px-4 py-2 font-medium">ICD-10</th>
                  <th className="text-right px-4 py-2 font-medium">الكمية</th>
                  <th className="text-right px-4 py-2 font-medium">سعر الوحدة</th>
                  <th className="text-right px-4 py-2 font-medium">المبلغ المطالب</th>
                  <th className="text-right px-4 py-2 font-medium">الموافق عليه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.line_items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{item.description_ar}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.icd10Code ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {item.unitPrice.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {item.claimedAmount.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-green-700">
                      {item.approvedAmount != null
                        ? `${item.approvedAmount.toLocaleString('ar-EG')} ج.م`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Previous Decision */}
      {detail.reviewed_at && detail.rejection_reason_ar && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <h3 className="font-semibold text-red-800 mb-2">سبب الرفض</h3>
          <p className="text-red-700">{detail.rejection_reason_ar}</p>
          {detail.rejection_code && (
            <p className="text-xs text-red-500 mt-1">كود: {detail.rejection_code}</p>
          )}
        </div>
      )}

      {/* Decision Actions */}
      {canDecide && !showDecisionForm && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              setForm({ ...form, decision: 'approve', approved_amount_egp: String(detail.claimed_amount_egp) });
              setShowDecisionForm(true);
            }}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            موافقة
          </button>
          <button
            onClick={() => {
              setForm({ ...form, decision: 'approve_partial' });
              setShowDecisionForm(true);
            }}
            className="px-5 py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
          >
            موافقة جزئية
          </button>
          <button
            onClick={() => {
              setForm({ ...form, decision: 'reject' });
              setShowDecisionForm(true);
            }}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            رفض
          </button>
        </div>
      )}

      {showDecisionForm && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {form.decision === 'reject' ? 'نموذج الرفض' : 'نموذج الموافقة'}
          </h3>

          {/* Decision Type Selector */}
          <div className="flex gap-2 mb-5">
            {(['approve', 'approve_partial', 'reject'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setForm({ ...form, decision: d })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.decision === d
                    ? d === 'reject'
                      ? 'bg-red-600 text-white'
                      : 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {d === 'approve' ? 'موافقة' : d === 'approve_partial' ? 'موافقة جزئية' : 'رفض'}
              </button>
            ))}
          </div>

          {(form.decision === 'approve' || form.decision === 'approve_partial') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">المبلغ الموافق عليه (ج.م)</label>
                <input
                  type="number"
                  value={form.approved_amount_egp}
                  onChange={(e) => setForm({ ...form, approved_amount_egp: e.target.value })}
                  placeholder={String(detail.claimed_amount_egp)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">ملاحظات (اختياري)</label>
                <textarea
                  value={form.notes_ar}
                  onChange={(e) => setForm({ ...form, notes_ar: e.target.value })}
                  rows={3}
                  placeholder="ملاحظات..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
          )}

          {form.decision === 'reject' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">سبب الرفض</label>
                <textarea
                  value={form.rejection_reason_ar}
                  onChange={(e) => setForm({ ...form, rejection_reason_ar: e.target.value })}
                  rows={3}
                  placeholder="سبب رفض المطالبة..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">كود الرفض</label>
                <input
                  type="text"
                  value={form.rejection_code}
                  onChange={(e) => setForm({ ...form, rejection_code: e.target.value })}
                  placeholder="R001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleDecision}
              disabled={saving}
              className={`px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                form.decision === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saving ? 'جاري الحفظ...' : form.decision === 'reject' ? 'تأكيد الرفض' : 'تأكيد الموافقة'}
            </button>
            <button
              onClick={() => setShowDecisionForm(false)}
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

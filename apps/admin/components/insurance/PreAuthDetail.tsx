'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { PreauthStatus } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreAuthFull {
  id: string;
  patient_name: string;
  patient_phone: string | null;
  policy_number: string;
  insurer_name: string;
  procedure_type: string;
  procedure_description_ar: string;
  procedure_description_en: string | null;
  icd10_code: string | null;
  estimated_cost_egp: number | null;
  clinical_justification_ar: string;
  clinical_justification_en: string | null;
  urgency: string;
  doctor_name: string | null;
  requesting_provider: string | null;
  status: PreauthStatus;
  submitted_at: string;
  reviewed_at: string | null;
  approved_amount_egp: number | null;
  approval_conditions_ar: string | null;
  denial_reason_ar: string | null;
  denial_code: string | null;
  preauth_reference: string | null;
  valid_from: string | null;
  valid_until: string | null;
}

type DecisionType = 'approve' | 'approve_partial' | 'deny';

interface DecisionForm {
  decision: DecisionType;
  approved_amount_egp: string;
  approval_conditions_ar: string;
  preauth_reference: string;
  valid_from: string;
  valid_until: string;
  denial_reason_ar: string;
  denial_code: string;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_BADGES: Record<PreauthStatus, { label: string; className: string }> = {
  submitted: { label: 'مقدم', className: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'قيد المراجعة', className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'موافق', className: 'bg-green-100 text-green-700' },
  approved_partial: { label: 'موافق جزئياً', className: 'bg-lime-100 text-lime-700' },
  denied: { label: 'مرفوض', className: 'bg-red-100 text-red-700' },
  expired: { label: 'منتهي', className: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'ملغي', className: 'bg-gray-100 text-gray-500' },
};

const URGENCY_LABELS: Record<string, string> = {
  routine: 'عادي',
  urgent: 'عاجل',
  emergency: 'طوارئ',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PreAuthDetail({ requestId }: { requestId: string }) {
  const [detail, setDetail] = useState<PreAuthFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DecisionForm>({
    decision: 'approve',
    approved_amount_egp: '',
    approval_conditions_ar: '',
    preauth_reference: '',
    valid_from: '',
    valid_until: '',
    denial_reason_ar: '',
    denial_code: '',
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

      const res = await fetch(`/api/admin/insurance/preauth/${requestId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDetail(data.request ?? data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [requestId]);

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
        body.approval_conditions_ar = form.approval_conditions_ar || null;
        body.preauth_reference = form.preauth_reference || null;
        body.valid_from = form.valid_from || null;
        body.valid_until = form.valid_until || null;
      } else {
        body.denial_reason_ar = form.denial_reason_ar || null;
        body.denial_code = form.denial_code || null;
      }

      const res = await fetch(`/api/admin/insurance/preauth/${requestId}/decide`, {
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
        <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse h-32" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-white rounded-xl shadow-sm text-center py-16">
        <span className="text-4xl mb-3 block">❌</span>
        <p className="text-gray-500 text-sm">لم يتم العثور على الطلب</p>
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
        <Link
          href="/insurance/pre-auth"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← العودة للقائمة
        </Link>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Patient & Policy Info */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">بيانات المريض</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">اسم المريض</p>
            <p className="font-medium text-gray-900">{detail.patient_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">رقم البوليصة</p>
            <p className="font-mono text-sm text-gray-700">{detail.policy_number}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">شركة التأمين</p>
            <p className="text-gray-700">{detail.insurer_name}</p>
          </div>
        </div>
      </div>

      {/* Procedure Details */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">تفاصيل الإجراء</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">نوع الإجراء</p>
            <p className="font-medium text-gray-900">{detail.procedure_type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">الوصف</p>
            <p className="text-gray-700">{detail.procedure_description_ar}</p>
          </div>
          {detail.icd10_code && (
            <div>
              <p className="text-xs text-gray-500">رمز ICD-10</p>
              <p className="font-mono text-sm text-gray-700">{detail.icd10_code}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">التكلفة المتوقعة</p>
            <p className="font-bold text-gray-900">
              {detail.estimated_cost_egp
                ? `${detail.estimated_cost_egp.toLocaleString('ar-EG')} ج.م`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">الأولوية</p>
            <p className="text-gray-700">{URGENCY_LABELS[detail.urgency] ?? detail.urgency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">الطبيب المعالج</p>
            <p className="text-gray-700">{detail.doctor_name ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Clinical Justification */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">المبرر الطبي</h2>
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
          {detail.clinical_justification_ar}
        </p>
        {detail.clinical_justification_en && (
          <p className="text-gray-500 text-sm mt-3 whitespace-pre-wrap leading-relaxed" dir="ltr">
            {detail.clinical_justification_en}
          </p>
        )}
      </div>

      {/* Previous Decision (if already decided) */}
      {detail.reviewed_at && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">القرار السابق</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detail.approved_amount_egp != null && (
              <div>
                <p className="text-xs text-gray-500">المبلغ الموافق عليه</p>
                <p className="font-bold text-green-700">{detail.approved_amount_egp.toLocaleString('ar-EG')} ج.م</p>
              </div>
            )}
            {detail.preauth_reference && (
              <div>
                <p className="text-xs text-gray-500">رقم الموافقة</p>
                <p className="font-mono text-sm">{detail.preauth_reference}</p>
              </div>
            )}
            {detail.approval_conditions_ar && (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500">الشروط</p>
                <p className="text-gray-700">{detail.approval_conditions_ar}</p>
              </div>
            )}
            {detail.denial_reason_ar && (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500">سبب الرفض</p>
                <p className="text-red-700">{detail.denial_reason_ar}</p>
                {detail.denial_code && (
                  <p className="text-xs text-gray-500 mt-1">كود: {detail.denial_code}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision Form */}
      {canDecide && !showDecisionForm && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              setForm({ ...form, decision: 'approve' });
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
              setForm({ ...form, decision: 'deny' });
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
            {form.decision === 'deny' ? 'نموذج الرفض' : 'نموذج الموافقة'}
          </h3>

          {/* Decision Type Selector */}
          <div className="flex gap-2 mb-5">
            {(['approve', 'approve_partial', 'deny'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setForm({ ...form, decision: d })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.decision === d
                    ? d === 'deny'
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
                  placeholder={detail.estimated_cost_egp?.toString() ?? ''}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">رقم الموافقة المرجعي</label>
                <input
                  type="text"
                  value={form.preauth_reference}
                  onChange={(e) => setForm({ ...form, preauth_reference: e.target.value })}
                  placeholder="PA-2024-XXXX"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">صالحة من</label>
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">صالحة حتى</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">الشروط (اختياري)</label>
                <textarea
                  value={form.approval_conditions_ar}
                  onChange={(e) => setForm({ ...form, approval_conditions_ar: e.target.value })}
                  rows={3}
                  placeholder="أي شروط للموافقة..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
          )}

          {form.decision === 'deny' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">سبب الرفض</label>
                <textarea
                  value={form.denial_reason_ar}
                  onChange={(e) => setForm({ ...form, denial_reason_ar: e.target.value })}
                  rows={3}
                  placeholder="سبب رفض الموافقة المسبقة..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">كود الرفض</label>
                <input
                  type="text"
                  value={form.denial_code}
                  onChange={(e) => setForm({ ...form, denial_code: e.target.value })}
                  placeholder="D001"
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
                form.decision === 'deny'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saving ? 'جاري الحفظ...' : form.decision === 'deny' ? 'تأكيد الرفض' : 'تأكيد الموافقة'}
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

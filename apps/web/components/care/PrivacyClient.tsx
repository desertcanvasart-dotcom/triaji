'use client';

import { useEffect, useState, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import LanguageToggle from '@/components/shared/LanguageToggle';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorInfo {
  name_ar: string;
  name_en: string;
  specialty_name_ar: string;
  specialty_name_en: string;
  clinic_name_ar?: string;
  clinic_name_en?: string;
}

interface AccessGrant {
  id: string;
  doctorAccountId: string;
  scope: string;
  conditionsFilter: string[] | null;
  grantedAt: string;
  expiresAt: string;
  doctor: DoctorInfo | null;
}

interface GPRelationship {
  id: string;
  status: string;
  assignedAt: string;
  doctor: DoctorInfo & { id: string } | null;
}

interface TreatingDoctor {
  id: string;
  name_ar: string;
  name_en: string;
  specialty_name_ar: string;
  specialty_name_en: string;
}

interface ConsentData {
  grants: AccessGrant[];
  gp: GPRelationship | null;
  treatingDoctors: TreatingDoctor[];
}

interface PrivacyClientProps {
  lang: Lang;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const ps = {
  title: { ar: 'الخصوصية والأذونات', en: 'Privacy & Permissions' },
  subtitle: { ar: 'تحكم في من يطلع على بياناتك الطبية', en: 'Control who can access your medical data' },
  gpSection: { ar: 'طبيب العائلة', en: 'General Practitioner (GP)' },
  gpActive: { ar: 'نشط', en: 'Active' },
  gpSince: { ar: 'منذ', en: 'Since' },
  noGP: { ar: 'لم يتم تعيين طبيب عائلة بعد', en: 'No GP assigned yet' },
  tempAccess: { ar: 'أذونات مؤقتة', en: 'Temporary Access Grants' },
  noGrants: { ar: 'لا توجد أذونات مؤقتة حالياً', en: 'No temporary access grants' },
  scope: { ar: 'النطاق', en: 'Scope' },
  expiresAt: { ar: 'ينتهي في', en: 'Expires' },
  revoke: { ar: 'إلغاء', en: 'Revoke' },
  revoking: { ar: 'جاري الإلغاء...', en: 'Revoking...' },
  revoked: { ar: 'تم الإلغاء', en: 'Revoked' },
  treatingDoctors: { ar: 'الأطباء المعالجين', en: 'Treating Doctors' },
  noTreating: { ar: 'لا توجد زيارات سابقة', en: 'No previous visits' },
  grantNew: { ar: 'منح إذن جديد', en: 'Grant New Access' },
  selectDoctor: { ar: 'اختر الطبيب', en: 'Select Doctor' },
  selectScope: { ar: 'اختر نوع الوصول', en: 'Select Access Type' },
  expiryDays: { ar: 'مدة الصلاحية (بالأيام)', en: 'Validity (days)' },
  grant: { ar: 'منح الإذن', en: 'Grant Access' },
  granting: { ar: 'جاري المنح...', en: 'Granting...' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  scopeFull: { ar: 'وصول كامل', en: 'Full Access' },
  scopeVitals: { ar: 'العلامات الحيوية فقط', en: 'Vitals Only' },
  scopeLabs: { ar: 'نتائج التحاليل', en: 'Lab Results' },
  scopeMeds: { ar: 'الأدوية', en: 'Medications' },
  scopeConditions: { ar: 'الأمراض المزمنة', en: 'Conditions' },
  fromBookings: { ar: 'من الحجوزات', en: 'From bookings' },
  errorLoading: { ar: 'حصل مشكلة في تحميل البيانات', en: 'Failed to load data' },
};

function str(key: keyof typeof ps, lang: Lang): string {
  return (ps[key] as Record<string, string>)?.[lang] ?? key;
}

const SCOPE_LABELS: Record<string, { ar: string; en: string }> = {
  full: { ar: 'وصول كامل', en: 'Full Access' },
  vitals_only: { ar: 'العلامات الحيوية فقط', en: 'Vitals Only' },
  lab_results: { ar: 'نتائج التحاليل', en: 'Lab Results' },
  medications: { ar: 'الأدوية', en: 'Medications' },
  conditions: { ar: 'الأمراض المزمنة', en: 'Conditions' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, lang: Lang): string {
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PrivacyClient({ lang }: PrivacyClientProps) {
  const isRTL = lang === 'ar';
  const [data, setData] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantForm, setGrantForm] = useState({
    doctorId: '',
    scope: 'full',
    expiryDays: '30',
  });
  const [granting, setGranting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/consent');
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      setData(result);
    } catch {
      setError(str('errorLoading', lang));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRevoke = useCallback(async (grantId: string) => {
    setRevokingId(grantId);
    try {
      const res = await fetch(`/api/patient/consent/${grantId}`, { method: 'DELETE' });
      if (res.ok) {
        setData(prev => prev ? {
          ...prev,
          grants: prev.grants.filter(g => g.id !== grantId),
        } : null);
      }
    } finally {
      setRevokingId(null);
    }
  }, []);

  const handleGrant = useCallback(async () => {
    if (!grantForm.doctorId || !grantForm.scope) return;
    setGranting(true);
    try {
      const res = await fetch('/api/patient/consent/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: grantForm.doctorId,
          scope: grantForm.scope,
          expires_in_days: parseInt(grantForm.expiryDays) || 30,
        }),
      });
      if (res.ok) {
        setShowGrantModal(false);
        setGrantForm({ doctorId: '', scope: 'full', expiryDays: '30' });
        await fetchData();
      }
    } finally {
      setGranting(false);
    }
  }, [grantForm, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => { setError(null); setLoading(true); fetchData(); }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
            >
              {t('common.tryAgain', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto p-6 space-y-6 font-cairo">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A2F4A]">{str('title', lang)}</h1>
            <p className="text-gray-500 mt-1">{str('subtitle', lang)}</p>
          </div>
          <LanguageToggle lang={lang} />
        </div>

        {/* GP Section */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-[#1A2F4A] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {str('gpSection', lang)}
          </h2>
          {data?.gp?.doctor ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-teal-700 font-bold">{isRTL ? 'د' : 'Dr'}</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#1A2F4A]">
                  {isRTL ? `د. ${data.gp.doctor.name_ar}` : `Dr. ${data.gp.doctor.name_en || data.gp.doctor.name_ar}`}
                </p>
                <p className="text-sm text-gray-500">
                  {isRTL ? data.gp.doctor.specialty_name_ar : (data.gp.doctor.specialty_name_en || data.gp.doctor.specialty_name_ar)}
                </p>
              </div>
              <div className="text-end">
                <span className="inline-block px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  {str('gpActive', lang)}
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  {str('gpSince', lang)} {formatDate(data.gp.assignedAt, lang)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">{str('noGP', lang)}</p>
          )}
        </section>

        {/* Temporary Access Grants */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A2F4A] flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {str('tempAccess', lang)}
            </h2>
            <button
              type="button"
              onClick={() => setShowGrantModal(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {str('grantNew', lang)}
            </button>
          </div>

          {data?.grants && data.grants.length > 0 ? (
            <div className="space-y-3">
              {data.grants.map(grant => (
                <div key={grant.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A2F4A] truncate">
                      {grant.doctor
                        ? (isRTL ? `د. ${grant.doctor.name_ar}` : `Dr. ${grant.doctor.name_en || grant.doctor.name_ar}`)
                        : grant.doctorAccountId}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        {(SCOPE_LABELS[grant.scope] as Record<string, string> | undefined)?.[lang] ?? grant.scope}
                      </span>
                      <span>
                        {str('expiresAt', lang)} {formatDate(grant.expiresAt, lang)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(grant.id)}
                    disabled={revokingId === grant.id}
                    className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {revokingId === grant.id ? str('revoking', lang) : str('revoke', lang)}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">{str('noGrants', lang)}</p>
          )}
        </section>

        {/* Treating Doctors */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-[#1A2F4A] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {str('treatingDoctors', lang)}
          </h2>
          {data?.treatingDoctors && data.treatingDoctors.length > 0 ? (
            <div className="space-y-3">
              {data.treatingDoctors.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-blue-700 text-sm font-bold">{isRTL ? 'د' : 'Dr'}</span>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A2F4A] text-sm">
                      {isRTL ? `د. ${doc.name_ar}` : `Dr. ${doc.name_en || doc.name_ar}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isRTL ? doc.specialty_name_ar : (doc.specialty_name_en || doc.specialty_name_ar)}
                      <span className="mx-1">-</span>
                      {str('fromBookings', lang)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">{str('noTreating', lang)}</p>
          )}
        </section>

        {/* Grant Modal */}
        {showGrantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl" dir={isRTL ? 'rtl' : 'ltr'}>
              <h3 className="text-lg font-bold text-[#1A2F4A]">{str('grantNew', lang)}</h3>

              {/* Doctor selection - use treating doctors list */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {str('selectDoctor', lang)}
                </label>
                <select
                  value={grantForm.doctorId}
                  onChange={e => setGrantForm(prev => ({ ...prev, doctorId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">{str('selectDoctor', lang)}</option>
                  {(data?.treatingDoctors ?? []).map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {isRTL ? `د. ${doc.name_ar}` : `Dr. ${doc.name_en || doc.name_ar}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {str('selectScope', lang)}
                </label>
                <select
                  value={grantForm.scope}
                  onChange={e => setGrantForm(prev => ({ ...prev, scope: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{(label as Record<string, string>)[lang]}</option>
                  ))}
                </select>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {str('expiryDays', lang)}
                </label>
                <select
                  value={grantForm.expiryDays}
                  onChange={e => setGrantForm(prev => ({ ...prev, expiryDays: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="7">7 {isRTL ? 'أيام' : 'days'}</option>
                  <option value="14">14 {isRTL ? 'يوم' : 'days'}</option>
                  <option value="30">30 {isRTL ? 'يوم' : 'days'}</option>
                  <option value="90">90 {isRTL ? 'يوم' : 'days'}</option>
                  <option value="365">{isRTL ? 'سنة' : '1 year'}</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGrant}
                  disabled={!grantForm.doctorId || granting}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {granting ? str('granting', lang) : str('grant', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium rounded-lg transition-colors text-sm"
                >
                  {str('cancel', lang)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pt-4">
          {t('common.appName', lang)} — {t('common.disclaimer', lang)}
        </p>
      </div>
    </div>
  );
}

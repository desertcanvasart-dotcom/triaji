'use client';

import { useEffect, useState } from 'react';

interface ClinicTenant {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  tier: string;
  is_primary?: boolean;
}

const STRINGS = {
  ar: {
    title: 'منشآتي على دكتور تريو',
    affiliationsIntro: 'حسابك مرتبط بالمنشآت دي:',
    primaryBadge: 'الرئيسية',
    manageHint: 'لو عندك عيادة خاصة، تقدر تديرها (المواعيد، الاستقبال، الفواتير) من لوحة تحكم دكتور تريو للمنشآت بنفس بيانات الدخول.',
    intro: 'لسه معندكش عيادة خاصة على دكتور تريو؟ أنشئ صفحة لعيادتك ولوحة تحكم خاصة بيها — حتى لو بتشتغل في مستشفى أو عيادة تانية.',
    nameLabel: 'اسم العيادة (بالعربي)',
    nameEnLabel: 'اسم العيادة (بالإنجليزي — اختياري)',
    addressLabel: 'عنوان العيادة (اختياري)',
    submit: 'إنشاء العيادة',
    submitting: 'جاري الإنشاء...',
    nameRequired: 'اسم العيادة مطلوب',
    success: 'تم إنشاء عيادتك! تقدر دلوقتي تديرها من لوحة تحكم المنشآت بنفس بيانات دخولك.',
  },
  en: {
    title: 'My facilities on DoctorTrio',
    affiliationsIntro: 'Your account is linked to these facilities:',
    primaryBadge: 'Primary',
    manageHint: 'If you own a clinic, manage it (appointments, reception, billing) from the DoctorTrio provider dashboard with this same login.',
    intro: 'No clinic of your own on DoctorTrio yet? Create your clinic page and its own admin dashboard — even if you also work at a hospital or another clinic.',
    nameLabel: 'Clinic name (Arabic)',
    nameEnLabel: 'Clinic name (English — optional)',
    addressLabel: 'Clinic address (optional)',
    submit: 'Create clinic',
    submitting: 'Creating…',
    nameRequired: 'Clinic name is required',
    success: 'Your clinic is live! You can now manage it from the provider dashboard with this same login.',
  },
} as const;

export default function MyClinicSection({ locale }: { locale: 'ar' | 'en' }) {
  const t = STRINGS[locale];
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<ClinicTenant[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  useEffect(() => {
    fetch('/api/doctor/clinic')
      .then((r) => (r.ok ? r.json() : { clinics: [], canCreate: false }))
      .then((d) => {
        setClinics(d.clinics ?? (d.clinic ? [d.clinic] : []));
        setCanCreate(!!d.canCreate);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!nameAr.trim()) {
      setError(t.nameRequired);
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/doctor/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_name_ar: nameAr.trim(),
        clinic_name_en: nameEn.trim() || undefined,
        address_ar: address.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? 'Error');
      return;
    }
    setClinics((prev) => [...prev, data.clinic]);
    setCanCreate(false);
    setCreated(true);
  }

  if (loading || (clinics.length === 0 && !canCreate)) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#1A2F4A] mb-3">{t.title}</h2>

      {clinics.length > 0 && (
        <div className="mb-3">
          {created && <p className="text-sm text-teal-700 mb-2">{t.success}</p>}
          <p className="text-sm text-gray-700 mb-2">{t.affiliationsIntro}</p>
          <ul className="space-y-1.5">
            {clinics.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900">
                  {locale === 'ar' ? c.name_ar || c.name_en : c.name_en || c.name_ar}
                </span>
                {c.is_primary && (
                  <span className="text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5">
                    {t.primaryBadge}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-2">{t.manageHint}</p>
        </div>
      )}

      {canCreate && (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-gray-500">{t.intro}</p>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t.nameLabel}</p>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir="rtl"
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t.nameEnLabel}</p>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              dir="ltr"
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t.addressLabel}</p>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </form>
      )}
    </div>
  );
}

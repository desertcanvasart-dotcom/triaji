'use client';

import { useEffect, useState } from 'react';

interface ClinicTenant {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  tier: string;
}

const STRINGS = {
  ar: {
    title: 'عيادتي على ترياچي',
    linkedTo: 'حسابك مرتبط بـ',
    manageHint: 'تقدر تدير العيادة (المواعيد، الاستقبال، الفواتير) من لوحة تحكم ترياچي للمنشآت بنفس بيانات الدخول.',
    intro: 'لسه معندكش عيادة على ترياچي؟ أنشئ صفحة لعيادتك ولوحة تحكم خاصة بيها.',
    nameLabel: 'اسم العيادة (بالعربي)',
    nameEnLabel: 'اسم العيادة (بالإنجليزي — اختياري)',
    addressLabel: 'عنوان العيادة (اختياري)',
    submit: 'إنشاء العيادة',
    submitting: 'جاري الإنشاء...',
    nameRequired: 'اسم العيادة مطلوب',
    success: 'تم إنشاء عيادتك! تقدر دلوقتي تديرها من لوحة تحكم المنشآت بنفس بيانات دخولك.',
  },
  en: {
    title: 'My clinic on Triajji',
    linkedTo: 'Your account is linked to',
    manageHint: 'Manage the clinic (appointments, reception, billing) from the Triajji provider dashboard with this same login.',
    intro: 'No clinic on Triajji yet? Create your clinic page and its own admin dashboard.',
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
  const [clinic, setClinic] = useState<ClinicTenant | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  useEffect(() => {
    fetch('/api/doctor/clinic')
      .then((r) => (r.ok ? r.json() : { clinic: null, canCreate: false }))
      .then((d) => {
        setClinic(d.clinic ?? null);
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
    setClinic(data.clinic);
    setCreated(true);
  }

  if (loading || (!clinic && !canCreate)) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#1A2F4A] mb-3">{t.title}</h2>

      {clinic ? (
        <div>
          {created && <p className="text-sm text-teal-700 mb-2">{t.success}</p>}
          <p className="text-sm text-gray-700">
            {t.linkedTo}{' '}
            <span className="font-semibold">
              {locale === 'ar' ? clinic.name_ar || clinic.name_en : clinic.name_en || clinic.name_ar}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-1">{t.manageHint}</p>
        </div>
      ) : (
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

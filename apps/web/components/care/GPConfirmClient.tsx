'use client';

import { useEffect, useState, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GPRequest {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  doctor: {
    name_ar: string;
    name_en: string;
    specialty_name_ar: string;
    specialty_name_en: string;
    clinic_name_ar: string | null;
    clinic_name_en: string | null;
    years_of_experience: number | null;
  } | null;
}

interface GPConfirmClientProps {
  gpRequestId: string;
  lang: Lang;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function ConfirmSkeleton() {
  return (
    <div className="max-w-lg mx-auto p-6 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded w-2/3 mx-auto" />
      <div className="h-32 bg-gray-100 rounded-xl" />
      <div className="h-24 bg-gray-100 rounded-xl" />
      <div className="flex gap-4">
        <div className="h-12 bg-gray-200 rounded-lg flex-1" />
        <div className="h-12 bg-gray-200 rounded-lg flex-1" />
      </div>
    </div>
  );
}

// ─── Strings ────────────────────────────────────────────────────────────────

const strings = {
  title: { ar: 'طلب طبيب عائلة', en: 'GP Assignment Request' },
  subtitle: {
    ar: 'طبيب عائلة يتابع صحتك بشكل مستمر',
    en: 'A GP monitors your health continuously',
  },
  doctorWants: {
    ar: 'يرغب في أن يكون طبيب عائلتك',
    en: 'would like to be your GP',
  },
  specialty: { ar: 'التخصص', en: 'Specialty' },
  clinic: { ar: 'العيادة', en: 'Clinic' },
  experience: { ar: 'سنوات الخبرة', en: 'Years of experience' },
  benefitsTitle: { ar: 'مميزات طبيب العائلة', en: 'Benefits of having a GP' },
  benefit1: {
    ar: 'متابعة مستمرة لحالتك الصحية والأمراض المزمنة',
    en: 'Continuous monitoring of your health and chronic conditions',
  },
  benefit2: {
    ar: 'تنبيهات فورية عند وجود قراءات غير طبيعية',
    en: 'Immediate alerts when abnormal readings are detected',
  },
  benefit3: {
    ar: 'تنسيق بين التخصصات المختلفة',
    en: 'Coordination between different specialties',
  },
  benefit4: {
    ar: 'ملاحظات طبية دورية ومتابعة الأدوية',
    en: 'Regular medical notes and medication follow-ups',
  },
  accept: { ar: 'موافق', en: 'Accept' },
  decline: { ar: 'رفض', en: 'Decline' },
  accepted: { ar: 'تم قبول الطلب بنجاح', en: 'Request accepted successfully' },
  declined: { ar: 'تم رفض الطلب', en: 'Request declined' },
  alreadyProcessed: { ar: 'تم معالجة هذا الطلب مسبقاً', en: 'This request has already been processed' },
  notFound: { ar: 'الطلب غير موجود', en: 'Request not found' },
  errorLoading: { ar: 'حصل مشكلة في تحميل الطلب', en: 'Failed to load the request' },
  processing: { ar: 'جاري المعالجة...', en: 'Processing...' },
};

function s(key: keyof typeof strings, lang: Lang): string {
  return (strings[key] as Record<string, string>)?.[lang] ?? key;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GPConfirmClient({ gpRequestId, lang }: GPConfirmClientProps) {
  const isRTL = lang === 'ar';
  const [gpRequest, setGpRequest] = useState<GPRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<'idle' | 'accepting' | 'declining' | 'done'>('idle');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRequest() {
      try {
        const res = await fetch(`/api/gp/confirm/${gpRequestId}`);
        if (res.status === 404) {
          setError(s('notFound', lang));
          return;
        }
        if (!res.ok) {
          setError(s('errorLoading', lang));
          return;
        }
        const data = await res.json();
        setGpRequest(data);

        if (data.status !== 'pending') {
          setActionStatus('done');
          setResultMessage(s('alreadyProcessed', lang));
        }
      } catch {
        setError(s('errorLoading', lang));
      } finally {
        setLoading(false);
      }
    }

    fetchRequest();
  }, [gpRequestId, lang]);

  const handleAction = useCallback(async (action: 'accept' | 'decline') => {
    setActionStatus(action === 'accept' ? 'accepting' : 'declining');
    try {
      const res = await fetch(`/api/gp/confirm/${gpRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setActionStatus('done');
        setResultMessage(action === 'accept' ? s('accepted', lang) : s('declined', lang));
      } else {
        setActionStatus('idle');
        setError(s('errorLoading', lang));
      }
    } catch {
      setActionStatus('idle');
      setError(s('errorLoading', lang));
    }
  }, [gpRequestId, lang]);

  if (loading) return <ConfirmSkeleton />;

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <p className="text-red-700 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  const doctor = gpRequest?.doctor;

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto p-6 space-y-6 font-cairo">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1A2F4A]">{s('title', lang)}</h1>
          <p className="text-gray-500">{s('subtitle', lang)}</p>
        </div>

        {/* Doctor info card */}
        {doctor && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#1A2F4A] rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-2xl font-bold">
                  {isRTL ? 'د' : 'Dr'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#1A2F4A]">
                {isRTL ? `د. ${doctor.name_ar}` : `Dr. ${doctor.name_en || doctor.name_ar}`}
              </h2>
              <p className="text-gray-500 mt-1">
                {s('doctorWants', lang)}
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="flex justify-between py-3">
                <span className="text-gray-500">{s('specialty', lang)}</span>
                <span className="font-medium text-[#1A2F4A]">
                  {isRTL ? doctor.specialty_name_ar : (doctor.specialty_name_en || doctor.specialty_name_ar)}
                </span>
              </div>
              {(doctor.clinic_name_ar || doctor.clinic_name_en) && (
                <div className="flex justify-between py-3">
                  <span className="text-gray-500">{s('clinic', lang)}</span>
                  <span className="font-medium text-[#1A2F4A]">
                    {isRTL ? doctor.clinic_name_ar : (doctor.clinic_name_en || doctor.clinic_name_ar)}
                  </span>
                </div>
              )}
              {doctor.years_of_experience && (
                <div className="flex justify-between py-3">
                  <span className="text-gray-500">{s('experience', lang)}</span>
                  <span className="font-medium text-[#1A2F4A]">
                    {doctor.years_of_experience} {isRTL ? 'سنة' : 'years'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="bg-teal-50 rounded-xl border border-teal-100 p-6">
          <h3 className="font-bold text-teal-800 mb-4">{s('benefitsTitle', lang)}</h3>
          <ul className="space-y-3">
            {['benefit1', 'benefit2', 'benefit3', 'benefit4'].map((key) => (
              <li key={key} className="flex items-start gap-3">
                <svg className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-teal-700 text-sm">
                  {s(key as keyof typeof strings, lang)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions or result */}
        {actionStatus === 'done' ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-700 font-medium text-lg">{resultMessage}</p>
          </div>
        ) : (
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleAction('accept')}
              disabled={actionStatus !== 'idle'}
              className="flex-1 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-lg"
            >
              {actionStatus === 'accepting' ? s('processing', lang) : s('accept', lang)}
            </button>
            <button
              type="button"
              onClick={() => handleAction('decline')}
              disabled={actionStatus !== 'idle'}
              className="flex-1 py-3.5 border-2 border-gray-300 text-gray-600 hover:bg-gray-50 font-bold rounded-xl transition-colors disabled:opacity-50 text-lg"
            >
              {actionStatus === 'declining' ? s('processing', lang) : s('decline', lang)}
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          {t('common.appName', lang)} — {t('common.disclaimer', lang)}
        </p>
      </div>
    </div>
  );
}

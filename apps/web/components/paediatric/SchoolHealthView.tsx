'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n';
import type { SchoolHealthRecord } from '@triaji/shared/types/paediatric';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SchoolHealthViewProps {
  childId: string;
  lang: Lang;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const STRINGS = {
  pageTitle: { ar: 'سجل الصحة المدرسية', en: 'School Health Records' },
  noRecords: { ar: 'لا توجد كشوفات صحة مدرسية حتى الآن', en: 'No school health records yet' },
  examDate: { ar: 'تاريخ الكشف', en: 'Exam date' },
  doctor: { ar: 'الطبيب', en: 'Doctor' },
  height: { ar: 'الطول', en: 'Height' },
  weight: { ar: 'الوزن', en: 'Weight' },
  vision: { ar: 'النظر', en: 'Vision' },
  hearing: { ar: 'السمع', en: 'Hearing' },
  normal: { ar: 'طبيعي', en: 'Normal' },
  abnormal: { ar: 'غير طبيعي', en: 'Abnormal' },
  dental: { ar: 'الأسنان', en: 'Dental' },
  notes: { ar: 'ملاحظات', en: 'Notes' },
  restrictions: { ar: 'قيود', en: 'Restrictions' },
  rightEye: { ar: 'يمين', en: 'R' },
  leftEye: { ar: 'يسار', en: 'L' },
  cm: { ar: 'سم', en: 'cm' },
  kg: { ar: 'كجم', en: 'kg' },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function SchoolHealthView({ childId, lang }: SchoolHealthViewProps) {
  const isRtl = lang === 'ar';
  const router = useRouter();
  const [records, setRecords] = useState<SchoolHealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const s = useCallback((key: keyof typeof STRINGS) => STRINGS[key][lang], [lang]);

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/patient/school-health?child_id=${childId}`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.push(`/${lang}/login`);
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setRecords(json);
    } catch {
      setError(t('common.error', lang));
    } finally {
      setIsLoading(false);
    }
  }, [childId, lang, router]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <span className="text-2xl">🏫</span>
            <h1 className="text-xl font-bold font-[Cairo]">{s('pageTitle')}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 animate-pulse font-[Cairo]">{t('common.loading', lang)}</div>
        </div>
      </main>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <span className="text-2xl">🏫</span>
            <h1 className="text-xl font-bold font-[Cairo]">{s('pageTitle')}</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-gray-500 font-[Cairo]">{error}</p>
          <button
            onClick={() => fetchRecords()}
            className="bg-teal-600 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors font-[Cairo]"
          >
            {t('common.tryAgain', lang)}
          </button>
        </div>
      </main>
    );
  }

  // ─── Fitness badge ────────────────────────────────────────────────────

  function fitnessBadge(record: SchoolHealthRecord) {
    if (record.fit_for_school && !record.restriction_ar) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 font-[Cairo]">
          {t('paediatric.fitForSchool', lang)}
        </span>
      );
    }
    if (record.fit_for_school && record.restriction_ar) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 font-[Cairo]">
          {t('paediatric.fitWithRestrictions', lang)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 font-[Cairo]">
        {t('paediatric.notFit', lang)}
      </span>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏫</span>
            <h1 className="text-xl font-bold font-[Cairo]">{s('pageTitle')}</h1>
          </div>
          <button
            onClick={() => router.back()}
            className="text-teal-100 text-sm font-[Cairo] hover:text-white transition-colors"
          >
            {t('common.back', lang)}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {records.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl mb-4 block">🏫</span>
              <p className="text-gray-500 font-[Cairo]">{s('noRecords')}</p>
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Card header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 font-[Cairo]">
                      {record.academic_year}
                    </span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-sm text-gray-600 font-[Cairo]">
                      {record.school_name_ar}
                    </span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-sm text-gray-600 font-[Cairo]">
                      {record.school_grade_ar}
                    </span>
                  </div>
                  {fitnessBadge(record)}
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-3">
                  {/* Exam date */}
                  {record.exam_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 font-[Cairo]">{s('examDate')}:</span>
                      <span className="text-gray-800" dir="ltr">
                        {new Date(record.exam_date).toLocaleDateString(
                          lang === 'ar' ? 'ar-EG' : 'en-US',
                          { year: 'numeric', month: 'long', day: 'numeric' }
                        )}
                      </span>
                    </div>
                  )}

                  {/* Physical measurements */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {record.height_cm && (
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500 font-[Cairo]">{s('height')}</p>
                        <p className="text-sm font-bold text-gray-800">
                          {record.height_cm} {s('cm')}
                        </p>
                      </div>
                    )}
                    {record.weight_kg && (
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500 font-[Cairo]">{s('weight')}</p>
                        <p className="text-sm font-bold text-gray-800">
                          {record.weight_kg} {s('kg')}
                        </p>
                      </div>
                    )}
                    {(record.vision_right || record.vision_left) && (
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500 font-[Cairo]">{s('vision')}</p>
                        <p className="text-sm font-bold text-gray-800" dir="ltr">
                          {record.vision_right && `${s('rightEye')}: ${record.vision_right}`}
                          {record.vision_right && record.vision_left && ' | '}
                          {record.vision_left && `${s('leftEye')}: ${record.vision_left}`}
                        </p>
                      </div>
                    )}
                    {record.hearing_normal !== null && (
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500 font-[Cairo]">{s('hearing')}</p>
                        <p className={`text-sm font-bold ${record.hearing_normal ? 'text-green-700' : 'text-red-700'}`}>
                          {record.hearing_normal ? s('normal') : s('abnormal')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Dental notes */}
                  {record.dental_notes_ar && (
                    <div>
                      <span className="text-xs text-gray-500 font-[Cairo]">{s('dental')}: </span>
                      <span className="text-sm text-gray-700 font-[Cairo]">{record.dental_notes_ar}</span>
                    </div>
                  )}

                  {/* General notes */}
                  {record.general_notes_ar && (
                    <div>
                      <span className="text-xs text-gray-500 font-[Cairo]">{s('notes')}: </span>
                      <span className="text-sm text-gray-700 font-[Cairo]">{record.general_notes_ar}</span>
                    </div>
                  )}

                  {/* Restrictions */}
                  {record.restriction_ar && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-yellow-600 font-[Cairo] font-medium">{s('restrictions')}: </span>
                      <span className="text-sm text-yellow-800 font-[Cairo]">{record.restriction_ar}</span>
                    </div>
                  )}

                  {/* Download certificate */}
                  {record.certificate_issued && record.certificate_pdf_url && (
                    <div className="pt-2 border-t border-gray-100">
                      <a
                        href={record.certificate_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-[Cairo] font-medium transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        {t('paediatric.downloadSchoolCert', lang)}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </main>
  );
}

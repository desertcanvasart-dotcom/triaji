'use client';

import { t, type Lang } from '@triaji/shared/i18n';

export interface LabResult {
  testCode: string;
  testNameAr: string;
  testNameEn: string;
  value: string;
  unit: string;
  isAbnormal: boolean;
  date: string;
}

interface LatestResultsProps {
  results: LabResult[];
  lang: Lang;
}

function formatResultDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LatestResults({ results, lang }: LatestResultsProps) {
  const isRtl = lang === 'ar';

  if (results.length === 0) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'}>
        <h3 className="text-base font-bold text-gray-900 mb-2">
          {t('medicalRecord.latestResults', lang)}
        </h3>
        <p className="text-sm text-gray-400">{t('medicalRecord.noResults', lang)}</p>
      </div>
    );
  }

  // Deduplicate: most recent per test code
  const latestByCode = new Map<string, LabResult>();
  for (const r of results) {
    const existing = latestByCode.get(r.testCode);
    if (!existing || new Date(r.date) > new Date(existing.date)) {
      latestByCode.set(r.testCode, r);
    }
  }
  const deduped = Array.from(latestByCode.values());

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-900">
          {t('medicalRecord.latestResults', lang)}
        </h3>
        <a
          href={`/${lang}/history`}
          className="text-xs text-teal-600 font-medium hover:underline"
        >
          {t('medicalRecord.viewAllResults', lang)}
        </a>
      </div>
      <div className="space-y-2">
        {deduped.map((r) => (
          <div
            key={r.testCode}
            className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {lang === 'ar' ? r.testNameAr : r.testNameEn}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatResultDate(r.date, lang)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-mono text-gray-700">
                {r.value} <span className="text-gray-400 text-xs">{r.unit}</span>
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  r.isAbnormal
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {r.isAbnormal
                  ? t('medicalRecord.abnormal', lang)
                  : t('medicalRecord.normal', lang)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

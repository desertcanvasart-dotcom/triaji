'use client';

import Link from 'next/link';
import { type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GPInfo {
  id: string;
  status: string;
  assignedAt: string;
  doctor: {
    id: string;
    name_ar: string;
    name_en: string;
    specialty_name_ar: string;
    specialty_name_en: string;
    clinic_name_ar?: string;
    clinic_name_en?: string;
  } | null;
}

interface GPSectionProps {
  gp: GPInfo | null;
  lang: Lang;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const strings = {
  title: { ar: 'طبيب العائلة', en: 'Your GP' },
  active: { ar: 'نشط', en: 'Active' },
  since: { ar: 'منذ', en: 'Since' },
  noGP: { ar: 'لم يتم تعيين طبيب عائلة بعد', en: 'No GP assigned yet' },
  noGPDesc: {
    ar: 'طبيب العائلة يتابع صحتك بشكل مستمر ويساعدك في إدارة الأمراض المزمنة',
    en: 'A GP monitors your health continuously and helps manage chronic conditions',
  },
  chooseGP: { ar: 'اختيار طبيب عائلة', en: 'Choose a GP' },
  managePrivacy: { ar: 'إدارة الأذونات', en: 'Manage Privacy' },
};

function s(key: keyof typeof strings, lang: Lang): string {
  return (strings[key] as Record<string, string>)?.[lang] ?? key;
}

function formatDate(dateStr: string, lang: Lang): string {
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GPSection({ gp, lang }: GPSectionProps) {
  const isRTL = lang === 'ar';

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[#1A2F4A] flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {s('title', lang)}
        </h3>
        <Link
          href={`/${lang}/privacy`}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
        >
          {s('managePrivacy', lang)}
        </Link>
      </div>

      {gp?.doctor ? (
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-teal-700 font-bold text-lg">{isRTL ? 'د' : 'Dr'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#1A2F4A] truncate">
              {isRTL ? `د. ${gp.doctor.name_ar}` : `Dr. ${gp.doctor.name_en || gp.doctor.name_ar}`}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {isRTL ? gp.doctor.specialty_name_ar : (gp.doctor.specialty_name_en || gp.doctor.specialty_name_ar)}
            </p>
          </div>
          <div className={`text-${isRTL ? 'start' : 'end'}`}>
            <span className="inline-block px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              {s('active', lang)}
            </span>
            <p className="text-xs text-gray-400 mt-1">
              {s('since', lang)} {formatDate(gp.assignedAt, lang)}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">{s('noGP', lang)}</p>
          <p className="text-gray-400 text-xs mb-4">{s('noGPDesc', lang)}</p>
          <Link
            href={`/${lang}/chat`}
            className="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {s('chooseGP', lang)}
          </Link>
        </div>
      )}
    </section>
  );
}

'use client';

import { t, type Lang } from '@triaji/shared/i18n';

interface Allergy {
  name_ar: string;
  name_en: string;
}

interface AllergiesBannerProps {
  allergies: Allergy[];
  lang: Lang;
}

export default function AllergiesBanner({ allergies, lang }: AllergiesBannerProps) {
  const isRtl = lang === 'ar';

  if (allergies.length === 0) {
    return (
      <div
        className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm font-medium"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {t('medicalRecord.noAllergies', lang)}
      </div>
    );
  }

  const names = allergies.map((a) => (lang === 'ar' ? a.name_ar : a.name_en)).join(' \u2022 ');

  return (
    <div
      className="rounded-xl bg-red-600 text-white px-4 py-3"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold shrink-0">
          {t('medicalRecord.allergies', lang)}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium">{names}</p>
    </div>
  );
}

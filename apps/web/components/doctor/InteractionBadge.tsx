'use client';

/**
 * InteractionBadge — Small inline severity badge for medication rows.
 * Color: red for contraindicated/major, amber for moderate, gray for minor.
 */

import type { InteractionSeverity } from '@triaji/shared/types';

type Lang = 'ar' | 'en';

interface InteractionBadgeProps {
  severity: InteractionSeverity;
  drugPair: string;
  lang: Lang;
}

const SEVERITY_CONFIG: Record<
  InteractionSeverity,
  { bg: string; text: string; labelAr: string; labelEn: string }
> = {
  contraindicated: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    labelAr: 'ممنوع الجمع',
    labelEn: 'Contraindicated',
  },
  major: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    labelAr: 'خطير',
    labelEn: 'Major',
  },
  moderate: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    labelAr: 'متوسط',
    labelEn: 'Moderate',
  },
  minor: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    labelAr: 'بسيط',
    labelEn: 'Minor',
  },
};

export default function InteractionBadge({ severity, drugPair, lang }: InteractionBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  const label = lang === 'ar' ? config.labelAr : config.labelEn;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-[Cairo] ${config.bg} ${config.text}`}
      title={drugPair}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Dot indicator */}
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          severity === 'contraindicated' || severity === 'major'
            ? 'bg-red-500'
            : severity === 'moderate'
              ? 'bg-amber-500'
              : 'bg-gray-400'
        }`}
      />
      {label}
    </span>
  );
}

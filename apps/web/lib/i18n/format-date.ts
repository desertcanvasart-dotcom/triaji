import type { Lang } from '@triaji/shared/i18n';

export function formatDate(date: Date, lang: Lang): string {
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: Date, lang: Lang): string {
  return date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDoctorTitle(
  nameAr: string,
  nameEn: string | null,
  titleAr: string,
  lang: Lang
): string {
  if (lang === 'en') {
    return `Dr. ${nameEn ?? nameAr}`;
  }
  return `${titleAr} ${nameAr}`;
}

import type { UrgencyLevel } from '../types/enums';

export interface SpecialtyEntry {
  readonly name_ar: string;
  readonly name_en: string;
  readonly urgency_default: UrgencyLevel;
  readonly sort_order: number;
}

/**
 * 17 base medical specialties used across the Triaji platform.
 * Maps to the specialties table in the database.
 */
export const SPECIALTIES: readonly SpecialtyEntry[] = [
  {
    name_ar: 'باطنة',
    name_en: 'Internal Medicine',
    urgency_default: 'routine',
    sort_order: 1,
  },
  {
    name_ar: 'قلب وأوعية دموية',
    name_en: 'Cardiology',
    urgency_default: 'urgent',
    sort_order: 2,
  },
  {
    name_ar: 'مخ وأعصاب',
    name_en: 'Neurology',
    urgency_default: 'urgent',
    sort_order: 3,
  },
  {
    name_ar: 'عظام',
    name_en: 'Orthopedics',
    urgency_default: 'routine',
    sort_order: 4,
  },
  {
    name_ar: 'جلدية',
    name_en: 'Dermatology',
    urgency_default: 'routine',
    sort_order: 5,
  },
  {
    name_ar: 'أنف وأذن وحنجرة',
    name_en: 'ENT',
    urgency_default: 'routine',
    sort_order: 6,
  },
  {
    name_ar: 'عيون',
    name_en: 'Ophthalmology',
    urgency_default: 'routine',
    sort_order: 7,
  },
  {
    name_ar: 'مسالك بولية',
    name_en: 'Urology',
    urgency_default: 'routine',
    sort_order: 8,
  },
  {
    name_ar: 'جهاز هضمي',
    name_en: 'Gastroenterology',
    urgency_default: 'routine',
    sort_order: 9,
  },
  {
    name_ar: 'صدر',
    name_en: 'Pulmonology',
    urgency_default: 'routine',
    sort_order: 10,
  },
  {
    name_ar: 'أطفال',
    name_en: 'Pediatrics',
    urgency_default: 'routine',
    sort_order: 11,
  },
  {
    name_ar: 'نساء وتوليد',
    name_en: 'Obstetrics & Gynecology',
    urgency_default: 'routine',
    sort_order: 12,
  },
  {
    name_ar: 'نفسية',
    name_en: 'Psychiatry',
    urgency_default: 'routine',
    sort_order: 13,
  },
  {
    name_ar: 'جراحة عامة',
    name_en: 'General Surgery',
    urgency_default: 'urgent',
    sort_order: 14,
  },
  {
    name_ar: 'طوارئ',
    name_en: 'Emergency Medicine',
    urgency_default: 'emergency',
    sort_order: 15,
  },
  {
    name_ar: 'طب الأسرة',
    name_en: 'Family Medicine',
    urgency_default: 'routine',
    sort_order: 16,
  },
  {
    name_ar: 'أورام',
    name_en: 'Oncology',
    urgency_default: 'urgent',
    sort_order: 17,
  },
] as const;

/**
 * Find a specialty entry by English name (case-insensitive).
 */
export function getSpecialtyByNameEn(name: string): SpecialtyEntry | undefined {
  const lower = name.toLowerCase();
  return SPECIALTIES.find((s) => s.name_en.toLowerCase() === lower);
}

/**
 * Find a specialty entry by Arabic name.
 */
export function getSpecialtyByNameAr(name: string): SpecialtyEntry | undefined {
  return SPECIALTIES.find((s) => s.name_ar === name);
}

import type { GovernorateRegion } from '../types/tenant';

export interface GovernorateEntry {
  readonly code: string;
  readonly name_ar: string;
  readonly name_en: string;
  readonly region: GovernorateRegion;
}

/**
 * All 27 Egyptian governorates with Arabic/English names, region classification, and code.
 */
export const GOVERNORATES: readonly GovernorateEntry[] = [
  // ─── Cairo Metro ─────────────────────────────────────────────────────────
  {
    code: 'CAI',
    name_ar: 'القاهرة',
    name_en: 'Cairo',
    region: 'cairo_metro',
  },
  {
    code: 'GIZ',
    name_ar: 'الجيزة',
    name_en: 'Giza',
    region: 'cairo_metro',
  },
  {
    code: 'QAL',
    name_ar: 'القليوبية',
    name_en: 'Qalyubia',
    region: 'cairo_metro',
  },

  // ─── Delta ────────────────────────────────────────────────────────────────
  {
    code: 'ALX',
    name_ar: 'الإسكندرية',
    name_en: 'Alexandria',
    region: 'delta',
  },
  {
    code: 'DAK',
    name_ar: 'الدقهلية',
    name_en: 'Dakahlia',
    region: 'delta',
  },
  {
    code: 'SHR',
    name_ar: 'الشرقية',
    name_en: 'Sharqia',
    region: 'delta',
  },
  {
    code: 'GHR',
    name_ar: 'الغربية',
    name_en: 'Gharbia',
    region: 'delta',
  },
  {
    code: 'MNF',
    name_ar: 'المنوفية',
    name_en: 'Monufia',
    region: 'delta',
  },
  {
    code: 'BHR',
    name_ar: 'البحيرة',
    name_en: 'Beheira',
    region: 'delta',
  },
  {
    code: 'KFS',
    name_ar: 'كفر الشيخ',
    name_en: 'Kafr El Sheikh',
    region: 'delta',
  },
  {
    code: 'DMT',
    name_ar: 'دمياط',
    name_en: 'Damietta',
    region: 'delta',
  },

  // ─── Canal ────────────────────────────────────────────────────────────────
  {
    code: 'PTS',
    name_ar: 'بورسعيد',
    name_en: 'Port Said',
    region: 'canal',
  },
  {
    code: 'ISM',
    name_ar: 'الإسماعيلية',
    name_en: 'Ismailia',
    region: 'canal',
  },
  {
    code: 'SUZ',
    name_ar: 'السويس',
    name_en: 'Suez',
    region: 'canal',
  },

  // ─── Sinai ────────────────────────────────────────────────────────────────
  {
    code: 'NSN',
    name_ar: 'شمال سيناء',
    name_en: 'North Sinai',
    region: 'sinai',
  },
  {
    code: 'SSN',
    name_ar: 'جنوب سيناء',
    name_en: 'South Sinai',
    region: 'sinai',
  },

  // ─── Upper Egypt ──────────────────────────────────────────────────────────
  {
    code: 'FAY',
    name_ar: 'الفيوم',
    name_en: 'Fayoum',
    region: 'upper_egypt',
  },
  {
    code: 'BNS',
    name_ar: 'بني سويف',
    name_en: 'Beni Suef',
    region: 'upper_egypt',
  },
  {
    code: 'MNY',
    name_ar: 'المنيا',
    name_en: 'Minya',
    region: 'upper_egypt',
  },
  {
    code: 'AST',
    name_ar: 'أسيوط',
    name_en: 'Asyut',
    region: 'upper_egypt',
  },
  {
    code: 'SHG',
    name_ar: 'سوهاج',
    name_en: 'Sohag',
    region: 'upper_egypt',
  },
  {
    code: 'QNA',
    name_ar: 'قنا',
    name_en: 'Qena',
    region: 'upper_egypt',
  },
  {
    code: 'LXR',
    name_ar: 'الأقصر',
    name_en: 'Luxor',
    region: 'upper_egypt',
  },
  {
    code: 'ASW',
    name_ar: 'أسوان',
    name_en: 'Aswan',
    region: 'upper_egypt',
  },

  // ─── Border ───────────────────────────────────────────────────────────────
  {
    code: 'RDS',
    name_ar: 'البحر الأحمر',
    name_en: 'Red Sea',
    region: 'border',
  },
  {
    code: 'NVL',
    name_ar: 'الوادي الجديد',
    name_en: 'New Valley',
    region: 'border',
  },
  {
    code: 'MTR',
    name_ar: 'مطروح',
    name_en: 'Matruh',
    region: 'border',
  },
] as const;

/**
 * Lookup a governorate by its code.
 */
export function getGovernorateByCode(code: string): GovernorateEntry | undefined {
  return GOVERNORATES.find((g) => g.code === code);
}

/**
 * Get all governorates in a specific region.
 */
export function getGovernoratesByRegion(region: GovernorateRegion): readonly GovernorateEntry[] {
  return GOVERNORATES.filter((g) => g.region === region);
}

/**
 * Insurance normalization for Egyptian Arabic dialect.
 * Maps various Arabic spellings / colloquial references to insurance provider codes.
 */

const INSURANCE_DIALECT_MAP: Record<string, string> = {
  'أكسا': 'axa',
  'اكسا': 'axa',
  'ميتلايف': 'metlife',
  'أليانز': 'allianz',
  'اليانز': 'allianz',
  'بيوبا': 'bupa',
  'جي آي جي': 'gig',
  'التأمين الصحي الشامل': 'nhia',
  'الهيئة': 'nhia',
  'التأمين الصحي': 'nhia',
  'تأمين صحي حكومي': 'nhia',
  'مصر للتأمين': 'misr_life',
  'مصر لايف': 'misr_life',
  'مافيش تأمين': 'no_insurance',
  'لأ': 'no_insurance',
  'لا': 'no_insurance',
  'معنديش': 'no_insurance',
  'مفيش': 'no_insurance',
  'مش متأمن': 'no_insurance',
};

export function normalizeInsuranceResponse(text: string): string | null {
  const cleaned = text.trim();

  // Direct match
  const direct = INSURANCE_DIALECT_MAP[cleaned];
  if (direct) return direct;

  // Partial match
  for (const [keyword, code] of Object.entries(INSURANCE_DIALECT_MAP)) {
    if (cleaned.includes(keyword)) return code;
  }

  return null;
}

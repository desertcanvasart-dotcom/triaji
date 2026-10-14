/**
 * Prescription templates — shared shape + input sanitising for the
 * /api/doctor/prescription-templates routes (migration 076).
 *
 * A template stores the prescription form's content (minus client row ids).
 * Everything coming from the client is re-built field by field here so the
 * JSONB column only ever holds the known medication shape.
 */

export const MAX_TEMPLATES_PER_DOCTOR = 200;
export const MAX_TEMPLATE_MEDICATIONS = 30;

const ROUTES = ['oral', 'injection', 'topical', 'inhaled'] as const;
const FOLLOW_UP_UNITS = ['day', 'week', 'month'] as const;

export type TemplateRoute = (typeof ROUTES)[number];
export type FollowUpUnit = (typeof FOLLOW_UP_UNITS)[number];

export interface TemplateMedication {
  drugNameAr: string;
  drugNameEn: string;
  dose: string;
  route: TemplateRoute;
  frequencyAr: string;
  frequencyEn: string;
  durationAr: string;
  durationEn: string;
  instructionsAr: string;
  instructionsEn: string;
}

export interface PrescriptionTemplate {
  id: string;
  name: string;
  diagnosis_ar: string | null;
  diagnosis_en: string | null;
  medications: TemplateMedication[];
  pharmacist_notes: string | null;
  follow_up_value: number;
  follow_up_unit: FollowUpUnit;
  use_count: number;
  last_used_at: string | null;
  updated_at: string;
}

export const TEMPLATE_COLUMNS =
  'id, name, diagnosis_ar, diagnosis_en, medications, pharmacist_notes, follow_up_value, follow_up_unit, use_count, last_used_at, updated_at';

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function optStr(v: unknown, max: number): string | null {
  const s = str(v, max);
  return s ? s : null;
}

export function sanitizeMedications(input: unknown): TemplateMedication[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_TEMPLATE_MEDICATIONS)
    .map((raw): TemplateMedication => {
      const m = (raw ?? {}) as Record<string, unknown>;
      const route = ROUTES.includes(m.route as TemplateRoute) ? (m.route as TemplateRoute) : 'oral';
      return {
        drugNameAr: str(m.drugNameAr, 200),
        drugNameEn: str(m.drugNameEn, 200),
        dose: str(m.dose, 100),
        route,
        frequencyAr: str(m.frequencyAr, 200),
        frequencyEn: str(m.frequencyEn, 200),
        durationAr: str(m.durationAr, 100),
        durationEn: str(m.durationEn, 100),
        instructionsAr: str(m.instructionsAr, 500),
        instructionsEn: str(m.instructionsEn, 500),
      };
    })
    .filter((m) => m.drugNameAr || m.drugNameEn);
}

/** Build the writable columns from a request body. `null` name = invalid. */
export function templateFromBody(body: Record<string, unknown>) {
  const name = str(body.name, 80);
  const followUpValue = Number(body.follow_up_value);
  const followUpUnit = FOLLOW_UP_UNITS.includes(body.follow_up_unit as FollowUpUnit)
    ? (body.follow_up_unit as FollowUpUnit)
    : 'day';

  return {
    name: name || null,
    diagnosis_ar: optStr(body.diagnosis_ar, 300),
    diagnosis_en: optStr(body.diagnosis_en, 300),
    medications: sanitizeMedications(body.medications),
    pharmacist_notes: optStr(body.pharmacist_notes, 1000),
    follow_up_value:
      Number.isFinite(followUpValue) && followUpValue > 0 ? Math.min(Math.floor(followUpValue), 365) : 0,
    follow_up_unit: followUpUnit,
  };
}

/**
 * Custom exam fields (migration 078) — shared shapes and validation for the
 * /api/doctor/exam-fields and /api/doctor/consultation/[bookingId]/fields routes.
 */

export const EXAM_FIELD_TYPES = ['text', 'long_text', 'number', 'select', 'boolean'] as const;
export type ExamFieldType = (typeof EXAM_FIELD_TYPES)[number];

export const MAX_EXAM_FIELDS = 30;
export const MAX_OPTIONS = 20;

export interface ExamField {
  id: string;
  label: string;
  field_type: ExamFieldType;
  options: string[];
  unit: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export const EXAM_FIELD_COLUMNS = 'id, label, field_type, options, unit, is_required, sort_order, is_active';

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Writable columns from a request body. `partial` (PATCH) only returns the keys
 * present; otherwise label and type are required. Returns an error key instead
 * when the input can't be accepted.
 */
export function fieldFromBody(
  body: Record<string, unknown>,
  partial: boolean
): { ok: true; fields: Record<string, unknown> } | { ok: false; error: 'label' | 'type' | 'options' } {
  const out: Record<string, unknown> = {};

  if (!partial || 'label' in body) {
    const label = str(body.label, 80);
    if (!label) return { ok: false, error: 'label' };
    out.label = label;
  }

  let type: ExamFieldType | undefined;
  if (!partial || 'field_type' in body) {
    if (!EXAM_FIELD_TYPES.includes(body.field_type as ExamFieldType)) return { ok: false, error: 'type' };
    type = body.field_type as ExamFieldType;
    out.field_type = type;
  }

  if ('options' in body || type === 'select') {
    const options = Array.isArray(body.options)
      ? Array.from(new Set(body.options.map((o) => str(o, 60)).filter(Boolean))).slice(0, MAX_OPTIONS)
      : [];
    if (type === 'select' && options.length < 2) return { ok: false, error: 'options' };
    out.options = options;
  }

  if ('unit' in body) out.unit = str(body.unit, 20) || null;
  if ('is_required' in body) out.is_required = body.is_required === true;
  if ('is_active' in body) out.is_active = body.is_active === true;
  if ('sort_order' in body && Number.isInteger(body.sort_order)) out.sort_order = body.sort_order;

  return { ok: true, fields: out };
}

/** Normalise a value for a field, or null when it should be cleared / is invalid. */
export function normaliseValue(field: ExamField, raw: unknown): { value: string | null; invalid: boolean } {
  if (raw === null || raw === undefined || raw === '') return { value: null, invalid: false };

  switch (field.field_type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
      return Number.isFinite(n) ? { value: String(n), invalid: false } : { value: null, invalid: true };
    }
    case 'boolean':
      if (raw === true || raw === 'true') return { value: 'true', invalid: false };
      if (raw === false || raw === 'false') return { value: 'false', invalid: false };
      return { value: null, invalid: true };
    case 'select': {
      const v = String(raw);
      return field.options.includes(v) ? { value: v, invalid: false } : { value: null, invalid: true };
    }
    case 'long_text':
      return { value: String(raw).slice(0, 4000), invalid: false };
    default:
      return { value: String(raw).trim().slice(0, 500) || null, invalid: false };
  }
}

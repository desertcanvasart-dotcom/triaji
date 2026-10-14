/**
 * Visit types (migrations 075 + 079) — shared shape for the doctor portal.
 */

export interface VisitTypeRow {
  id: string;
  name: string;
  price_egp: number | null;
  duration_minutes: number;
  is_default: boolean;
}

/** Normalise a DB row (price may come back as a string, or be absent before migration 079). */
export function toVisitType(row: Record<string, unknown>): VisitTypeRow {
  const price = row.price_egp == null ? null : Number(row.price_egp);
  return {
    id: row.id as string,
    name: row.name as string,
    price_egp: price != null && Number.isFinite(price) ? price : null,
    duration_minutes: Number(row.duration_minutes) || 30,
    is_default: row.is_default === true,
  };
}

/**
 * Doctor reports ("الإدارة") — pure aggregation over a date range of the
 * doctor's bookings, queue entries and invoices. Kept free of I/O so the
 * numbers can be checked in isolation; /api/doctor/reports loads the rows.
 *
 * Dates are Cairo calendar days (YYYY-MM-DD). Booking times are floating
 * clinic-local timestamps, so their first 10 characters are the clinic day.
 */

export interface ReportBooking {
  id: string;
  appointment_datetime: string;
  appointment_type: string | null;
  status: string;
  patient_id: string | null;
  slot_id: string | null;
}

export interface ReportQueueEntry {
  id: string;
  queue_date: string;
  status: string;
  source: string;
  booking_id: string | null;
  patient_id: string | null;
  patient_phone: string | null;
  patient_name_ar: string | null;
  visit_type_id?: string | null;
}

export interface ReportInvoice {
  invoice_date: string;
  status: string;
  subtotal_egp: number | string | null;
  discount_egp: number | string | null;
  insurance_covered: number | string | null;
  patient_pays_egp: number | string | null;
  payment_method: string | null;
  booking_id: string | null;
  queue_entry_id: string | null;
  visit_type_id?: string | null;
}

export interface ReportVisitType {
  id: string;
  name: string;
}

export type Granularity = 'day' | 'month';

export interface ReportBucket {
  period: string; // YYYY-MM-DD or YYYY-MM
  visits: number;
  completed: number;
  no_show: number;
  billed: number;
  collected: number;
  insurance: number;
}

export interface DoctorReport {
  from: string;
  to: string;
  granularity: Granularity;
  visits: {
    total: number;
    completed: number;
    no_show: number;
    cancelled: number;
    scheduled: number;
    walk_ins: number;
    telehealth: number;
    unique_patients: number;
    no_show_rate: number | null; // 0–1, of visits that were due (completed + no-show)
  };
  money: {
    billed: number; // after discounts, before insurance
    discounts: number;
    insurance: number;
    patient_share: number;
    collected: number;
    outstanding: number;
    invoices: number;
    avg_per_visit: number | null; // billed ÷ invoices
  };
  series: ReportBucket[];
  by_visit_type: { id: string | null; name: string | null; invoices: number; billed: number }[];
  by_payment_method: { method: string; count: number; amount: number }[];
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const DAY_MS = 86_400_000;

/** Days between two YYYY-MM-DD dates, inclusive. */
export function daysInRange(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Daily buckets up to two months; monthly beyond that. */
export function granularityFor(from: string, to: string): Granularity {
  return daysInRange(from, to) <= 62 ? 'day' : 'month';
}

function periods(from: string, to: string, g: Granularity): string[] {
  const out: string[] = [];
  if (g === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  for (;;) {
    const p = `${y}-${String(m).padStart(2, '0')}`;
    out.push(p);
    if (p >= end) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

type VisitState = 'completed' | 'no_show' | 'cancelled' | 'scheduled';

export function buildDoctorReport(input: {
  from: string;
  to: string;
  bookings: ReportBooking[];
  queue: ReportQueueEntry[];
  invoices: ReportInvoice[];
  visitTypes: ReportVisitType[];
  /** slot id → visit type id, for bookings made into a typed slot. */
  slotVisitType: Map<string, string | null>;
}): DoctorReport {
  const { from, to } = input;
  const g = granularityFor(from, to);
  const bucketOf = (date: string) => (g === 'day' ? date.slice(0, 10) : date.slice(0, 7));
  const series = new Map<string, ReportBucket>(
    periods(from, to, g).map((p) => [p, { period: p, visits: 0, completed: 0, no_show: 0, billed: 0, collected: 0, insurance: 0 }])
  );

  // ── Visits: one per queue entry, plus bookings that never reached the queue ──
  const bookingById = new Map(input.bookings.map((b) => [b.id, b]));
  const queuedBookings = new Set(input.queue.map((q) => q.booking_id).filter(Boolean) as string[]);
  const visits: { date: string; state: VisitState; walkIn: boolean; telehealth: boolean; patient: string | null }[] = [];

  for (const q of input.queue) {
    const booking = q.booking_id ? bookingById.get(q.booking_id) : undefined;
    let state: VisitState =
      q.status === 'completed' ? 'completed' : q.status === 'no_show' || q.status === 'left' ? 'no_show' : 'scheduled';
    // A visit finished from the exam screen completes the booking, not the queue entry.
    if (state === 'scheduled' && booking?.status === 'completed') state = 'completed';
    visits.push({
      date: q.queue_date,
      state,
      walkIn: q.source === 'walk_in',
      telehealth: booking?.appointment_type === 'telehealth',
      patient: q.patient_id ?? booking?.patient_id ?? q.patient_phone ?? (q.patient_name_ar ? `name:${q.patient_name_ar}` : null),
    });
  }
  for (const b of input.bookings) {
    if (queuedBookings.has(b.id)) continue;
    const state: VisitState =
      b.status === 'completed' ? 'completed' : b.status === 'no_show' ? 'no_show' : b.status === 'cancelled' ? 'cancelled' : 'scheduled';
    visits.push({
      date: b.appointment_datetime.slice(0, 10),
      state,
      walkIn: false,
      telehealth: b.appointment_type === 'telehealth',
      patient: b.patient_id,
    });
  }

  const inRange = visits.filter((v) => v.date >= from && v.date <= to);
  const live = inRange.filter((v) => v.state !== 'cancelled');
  for (const v of live) {
    const bucket = series.get(bucketOf(v.date));
    if (!bucket) continue;
    bucket.visits += 1;
    if (v.state === 'completed') bucket.completed += 1;
    if (v.state === 'no_show') bucket.no_show += 1;
  }
  const completed = live.filter((v) => v.state === 'completed').length;
  const noShow = live.filter((v) => v.state === 'no_show').length;

  // ── Money: issued and paid invoices (drafts and cancelled ones don't count) ──
  const queueById = new Map(input.queue.map((q) => [q.id, q]));
  const typeName = new Map(input.visitTypes.map((t) => [t.id, t.name]));
  const byType = new Map<string, { id: string | null; name: string | null; invoices: number; billed: number }>();
  const byMethod = new Map<string, { method: string; count: number; amount: number }>();
  let billed = 0;
  let discounts = 0;
  let insurance = 0;
  let patientShare = 0;
  let collected = 0;
  let outstanding = 0;
  let invoiceCount = 0;

  for (const inv of input.invoices) {
    if (inv.status !== 'issued' && inv.status !== 'paid') continue;
    if (inv.invoice_date < from || inv.invoice_date > to) continue;
    const net = num(inv.subtotal_egp) - num(inv.discount_egp);
    const pays = num(inv.patient_pays_egp);
    const ins = num(inv.insurance_covered);
    const paid = inv.status === 'paid';

    invoiceCount += 1;
    billed += net;
    discounts += num(inv.discount_egp);
    insurance += ins;
    patientShare += pays;
    if (paid) collected += pays;
    else outstanding += pays;

    const bucket = series.get(bucketOf(inv.invoice_date));
    if (bucket) {
      bucket.billed += net;
      bucket.insurance += ins;
      if (paid) bucket.collected += pays;
    }

    // The invoice's own type, else the walk-in's, else the booked slot's.
    const queueType = inv.queue_entry_id ? queueById.get(inv.queue_entry_id)?.visit_type_id : null;
    const booking = inv.booking_id ? bookingById.get(inv.booking_id) : undefined;
    const slotType = booking?.slot_id ? input.slotVisitType.get(booking.slot_id) : null;
    const typeId = inv.visit_type_id ?? queueType ?? slotType ?? null;
    const known = typeId && typeName.has(typeId) ? typeId : null;
    const key = known ?? '';
    const row = byType.get(key) ?? { id: known, name: known ? typeName.get(known) ?? null : null, invoices: 0, billed: 0 };
    row.invoices += 1;
    row.billed += net;
    byType.set(key, row);

    if (paid) {
      const method = inv.payment_method ?? 'cash';
      const m = byMethod.get(method) ?? { method, count: 0, amount: 0 };
      m.count += 1;
      m.amount += pays;
      byMethod.set(method, m);
    }
  }

  return {
    from,
    to,
    granularity: g,
    visits: {
      total: live.length,
      completed,
      no_show: noShow,
      cancelled: inRange.length - live.length,
      scheduled: live.filter((v) => v.state === 'scheduled').length,
      walk_ins: live.filter((v) => v.walkIn).length,
      telehealth: live.filter((v) => v.telehealth).length,
      unique_patients: new Set(live.map((v) => v.patient).filter(Boolean)).size,
      no_show_rate: completed + noShow > 0 ? noShow / (completed + noShow) : null,
    },
    money: {
      billed: round2(billed),
      discounts: round2(discounts),
      insurance: round2(insurance),
      patient_share: round2(patientShare),
      collected: round2(collected),
      outstanding: round2(outstanding),
      invoices: invoiceCount,
      avg_per_visit: invoiceCount > 0 ? round2(billed / invoiceCount) : null,
    },
    series: [...series.values()].map((b) => ({
      ...b,
      billed: round2(b.billed),
      collected: round2(b.collected),
      insurance: round2(b.insurance),
    })),
    by_visit_type: [...byType.values()]
      .map((r) => ({ ...r, billed: round2(r.billed) }))
      .sort((a, b) => b.billed - a.billed),
    by_payment_method: [...byMethod.values()]
      .map((r) => ({ ...r, amount: round2(r.amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

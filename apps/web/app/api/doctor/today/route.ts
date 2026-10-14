import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateDoctorWorkspace, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { toVisitType } from '@/lib/doctor/visit-types';
import {
  sendCalledNotification,
  sendAlmostNextNotification,
} from '@triaji/shared/lib/clinic/queue-notifications';

export const dynamic = 'force-dynamic';

/**
 * Doctor work-day screen — one view of today's patients for the signed-in doctor.
 *
 * GET merges three sources for the day:
 *   - bookings        (appointment_datetime is a floating clinic-local wall clock,
 *                      see lib/slots.ts — "today" is the Cairo calendar date)
 *   - clinic_queue    (walk-ins and checked-in bookings, numbered per doctor/day)
 *   - clinic_invoices (what was billed / paid, incl. the insurance share)
 *
 * POST runs the front-desk actions a doctor without a receptionist needs:
 * check_in, walk_in, call_next, call, complete, no_show. They mirror the admin
 * reception endpoints (apps/admin/app/api/admin/queue/*) but are scoped to the
 * doctor's own rows instead of a tenant admin.
 */

type QueueStatus = 'waiting' | 'called' | 'completed' | 'no_show' | 'left' | 'skipped';
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export type TodayRowState =
  | 'expected'
  | 'waiting'
  | 'called'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'left';

interface QueueRow {
  id: string;
  tenant_id: string;
  queue_number: number;
  status: QueueStatus;
  source: 'walk_in' | 'online_booking' | 'phone_booking';
  booking_id: string | null;
  patient_name_ar: string;
  patient_phone: string | null;
  chief_complaint_ar: string | null;
  arrived_at: string;
  called_at: string | null;
  /** migration 079 — absent before it is applied */
  visit_type_id?: string | null;
}

interface PatientEmbed { name_ar: string | null; phone_number: string | null }
interface SummaryEmbed { chief_complaint_ar: string | null; urgency_level: 'routine' | 'urgent' | 'emergency' | null }
interface SessionEmbed { session_summaries: SummaryEmbed | SummaryEmbed[] | null }
interface BookingRow {
  id: string;
  tenant_id: string | null;
  slot_id: string | null;
  appointment_datetime: string;
  appointment_type: 'in_person' | 'telehealth' | null;
  status: BookingStatus;
  patients: PatientEmbed | PatientEmbed[] | null;
  triage_sessions: SessionEmbed | SessionEmbed[] | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  booking_id: string | null;
  queue_entry_id: string | null;
  subtotal_egp: number | string;
  discount_egp: number | string;
  insurance_covered: number | string;
  patient_pays_egp: number | string;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
}

export interface TodayBilling {
  total: number;
  insurance: number;
  patient_pays: number;
  paid: boolean;
  /** The oldest unpaid invoice, so the screen can record its payment. */
  unpaid_invoice_id: string | null;
  invoice_numbers: string[];
}

export interface TodayRow {
  key: string;
  queue_id: string | null;
  booking_id: string | null;
  queue_number: number | null;
  appointment_datetime: string | null;
  arrived_at: string | null;
  source: 'booking' | 'walk_in';
  appointment_type: 'in_person' | 'telehealth';
  patient_name: string | null;
  patient_phone: string | null;
  chief_complaint: string | null;
  urgency: 'routine' | 'urgent' | 'emergency' | null;
  state: TodayRowState;
  billing: TodayBilling | null;
  /** The visit type (كشف / استشارة …) and its price, when known. */
  visit_type: { id: string; name: string; price_egp: number | null } | null;
}

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  noProfile: { ar: 'حسابك لسه مش مربوط بملف طبيب', en: 'Your account is not linked to a doctor profile yet' },
  noClinic: {
    ar: 'لازم تربط عيادة بحسابك من الإعدادات الأول',
    en: 'Link a clinic to your account in Settings first',
  },
  notFound: { ar: 'المريض ده مش موجود في قايمتك', en: 'That patient is not on your list' },
  alreadyIn: { ar: 'المريض ده متسجل حضوره بالفعل', en: 'This patient is already checked in' },
  noneWaiting: { ar: 'مفيش مرضى في الانتظار', en: 'No patients waiting' },
  nameRequired: { ar: 'اسم المريض مطلوب', en: 'Patient name is required' },
  badAction: { ar: 'إجراء غير معروف', en: 'Unknown action' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

type Locale = 'ar' | 'en';

/** PostgREST returns embedded relations as an object or a single-element array. */
function first<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** Today's calendar date in Egypt (YYYY-MM-DD). */
function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function billingFrom(invoices: InvoiceRow[]): TodayBilling | null {
  const live = invoices.filter((i) => i.status !== 'cancelled');
  if (live.length === 0) return null;
  return {
    total: live.reduce((s, i) => s + num(i.subtotal_egp) - num(i.discount_egp), 0),
    insurance: live.reduce((s, i) => s + num(i.insurance_covered), 0),
    patient_pays: live.reduce((s, i) => s + num(i.patient_pays_egp), 0),
    paid: live.every((i) => i.status === 'paid'),
    unpaid_invoice_id: live.find((i) => i.status !== 'paid')?.id ?? null,
    invoice_numbers: live.map((i) => i.invoice_number).filter(Boolean) as string[],
  };
}

function queueState(status: QueueStatus): TodayRowState {
  if (status === 'skipped') return 'waiting';
  return status;
}

function bookingState(status: BookingStatus): TodayRowState {
  if (status === 'pending' || status === 'confirmed') return 'expected';
  return status;
}

/** The doctor's primary facility — where walk-ins and check-ins are queued. */
async function primaryTenant(supabase: SupabaseClient, doctorId: string): Promise<string | null> {
  const { data } = await supabase.from('doctors').select('tenant_id').eq('id', doctorId).maybeSingle();
  return (data?.tenant_id as string | null) ?? null;
}

/** Insert a queue entry with the next number, retrying once on a numbering race. */
async function enqueue(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    doctor_id: string;
    queue_date: string;
    patient_id?: string | null;
    patient_name_ar: string;
    patient_phone?: string | null;
    source: 'walk_in' | 'online_booking';
    booking_id?: string | null;
    chief_complaint_ar?: string | null;
    visit_type_id?: string;
  }
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: queueNumber, error: rpcError } = await supabase.rpc('next_queue_number', {
      p_tenant_id: row.tenant_id,
      p_doctor_id: row.doctor_id,
      p_date: row.queue_date,
    });
    if (rpcError) throw new Error(rpcError.message);

    const { data, error } = await supabase
      .from('clinic_queue')
      .insert({ ...row, queue_number: queueNumber as number })
      .select()
      .single();

    if (!error) return data as QueueRow;
    if (error.code !== '23505') throw new Error(error.message);
  }
  throw new Error('Could not assign a queue number');
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const locale: Locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  try {
    const account = await authenticateDoctorWorkspace(request);
    if (!account) {
      return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    }
    if (!account.doctor_id) {
      return NextResponse.json({ error: T.noProfile[locale] }, { status: 400 });
    }

    const doctorId = account.doctor_id;
    const supabase = getDoctorServiceClient();
    const day = cairoToday();

    const [bookingsRes, queueRes, invoicesRes, doctorRes] = await Promise.all([
      // bookings.session_id and triage_sessions.booking_id both relate these
      // tables; the embed names the session that led to the booking.
      supabase
        .from('bookings')
        .select(`
          id, tenant_id, slot_id, appointment_datetime, appointment_type, status,
          patients(name_ar, phone_number),
          triage_sessions!session_id(session_summaries(chief_complaint_ar, urgency_level))
        `)
        .eq('doctor_id', doctorId)
        .gte('appointment_datetime', `${day}T00:00:00.000Z`)
        .lt('appointment_datetime', `${nextDay(day)}T00:00:00.000Z`)
        .order('appointment_datetime', { ascending: true }),
      supabase
        .from('clinic_queue')
        // '*' so the screen keeps working whether or not migration 079
        // (visit_type_id) is applied yet.
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('queue_date', day)
        .order('queue_number', { ascending: true }),
      supabase
        .from('clinic_invoices')
        .select(
          'id, invoice_number, booking_id, queue_entry_id, subtotal_egp, discount_egp, insurance_covered, patient_pays_egp, status'
        )
        .eq('doctor_id', doctorId)
        .eq('invoice_date', day)
        .order('created_at', { ascending: true }),
      supabase
        .from('doctors')
        .select('tenant_id, consultation_fee_egp')
        .eq('id', doctorId)
        .maybeSingle(),
    ]);

    if (bookingsRes.error || queueRes.error) {
      console.error(
        '[doctor/today] load failed:',
        bookingsRes.error?.message ?? queueRes.error?.message
      );
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    const bookings = (bookingsRes.data ?? []) as unknown as BookingRow[];
    const queue = (queueRes.data ?? []) as QueueRow[];
    // Invoices are optional context; a missing table/column must not hide the day.
    const invoices = invoicesRes.error ? [] : ((invoicesRes.data ?? []) as InvoiceRow[]);

    // Visit types: walk-ins carry one on the queue entry; bookings inherit the
    // type of the slot they were booked into.
    const slotIds = bookings.map((b) => b.slot_id).filter(Boolean) as string[];
    const [typesRes, slotsRes] = await Promise.all([
      supabase.from('doctor_visit_types').select('*').eq('doctor_id', doctorId),
      slotIds.length > 0
        ? supabase.from('doctor_availability').select('id, visit_type_id').in('id', slotIds)
        : Promise.resolve({ data: [] as { id: string; visit_type_id: string | null }[], error: null }),
    ]);
    const visitTypes = typesRes.error ? [] : (typesRes.data ?? []).map((r) => toVisitType(r as Record<string, unknown>));
    const typeById = new Map(visitTypes.map((v) => [v.id, v]));
    const slotType = new Map(
      ((slotsRes.error ? [] : slotsRes.data) ?? []).map((s) => [s.id as string, (s.visit_type_id as string | null) ?? null])
    );
    const visitTypeFor = (typeId: string | null | undefined) => {
      const v = typeId ? typeById.get(typeId) : undefined;
      return v ? { id: v.id, name: v.name, price_egp: v.price_egp } : null;
    };
    const bookingTypeId = (b: BookingRow | undefined) => (b?.slot_id ? slotType.get(b.slot_id) : null);

    const bookingById = new Map(bookings.map((b) => [b.id, b]));
    const queuedBookingIds = new Set(queue.map((q) => q.booking_id).filter(Boolean) as string[]);

    const rows: TodayRow[] = [];

    for (const q of queue) {
      const booking = q.booking_id ? bookingById.get(q.booking_id) : undefined;
      const summary = booking
        ? first(first(booking.triage_sessions)?.session_summaries ?? null)
        : null;
      let state = queueState(q.status);
      // A consultation finished from the exam screen completes the booking but
      // not the queue entry — trust the booking in that case.
      if (booking?.status === 'completed' && (state === 'waiting' || state === 'called')) {
        state = 'completed';
      }
      rows.push({
        key: `q:${q.id}`,
        queue_id: q.id,
        booking_id: q.booking_id,
        queue_number: q.queue_number,
        appointment_datetime: booking?.appointment_datetime ?? null,
        arrived_at: q.arrived_at,
        source: q.source === 'walk_in' ? 'walk_in' : 'booking',
        appointment_type: booking?.appointment_type ?? 'in_person',
        patient_name: q.patient_name_ar || first(booking?.patients)?.name_ar || null,
        patient_phone: maskPhone(q.patient_phone ?? first(booking?.patients)?.phone_number ?? null),
        chief_complaint: q.chief_complaint_ar ?? summary?.chief_complaint_ar ?? null,
        urgency: summary?.urgency_level ?? null,
        state,
        visit_type: visitTypeFor(q.visit_type_id ?? bookingTypeId(booking)),
        billing: billingFrom(
          invoices.filter(
            (i) => i.queue_entry_id === q.id || (q.booking_id && i.booking_id === q.booking_id)
          )
        ),
      });
    }

    for (const b of bookings) {
      if (queuedBookingIds.has(b.id)) continue;
      const patient = first(b.patients);
      const summary = first(first(b.triage_sessions)?.session_summaries ?? null);
      rows.push({
        key: `b:${b.id}`,
        queue_id: null,
        booking_id: b.id,
        queue_number: null,
        appointment_datetime: b.appointment_datetime,
        arrived_at: null,
        source: 'booking',
        appointment_type: b.appointment_type ?? 'in_person',
        patient_name: patient?.name_ar ?? null,
        patient_phone: maskPhone(patient?.phone_number ?? null),
        chief_complaint: summary?.chief_complaint_ar ?? null,
        urgency: summary?.urgency_level ?? null,
        state: bookingState(b.status),
        visit_type: visitTypeFor(bookingTypeId(b)),
        billing: billingFrom(invoices.filter((i) => i.booking_id === b.id)),
      });
    }

    // Work order: who's in the room, the queue by number, who's still expected
    // by appointment time, then everything that's finished.
    const rank: Record<TodayRowState, number> = {
      called: 0,
      waiting: 1,
      expected: 2,
      completed: 3,
      no_show: 4,
      left: 4,
      cancelled: 5,
    };
    rows.sort((a, b) => {
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
      if (a.queue_number != null && b.queue_number != null) return a.queue_number - b.queue_number;
      return (a.appointment_datetime ?? '').localeCompare(b.appointment_datetime ?? '');
    });

    const billed = rows.map((r) => r.billing).filter(Boolean) as TodayBilling[];
    const stats = {
      total: rows.filter((r) => r.state !== 'cancelled').length,
      expected: rows.filter((r) => r.state === 'expected').length,
      waiting: rows.filter((r) => r.state === 'waiting').length,
      completed: rows.filter((r) => r.state === 'completed').length,
      no_show: rows.filter((r) => r.state === 'no_show' || r.state === 'left').length,
      collected: billed.filter((b) => b.paid).reduce((s, b) => s + b.patient_pays, 0),
      outstanding: billed.filter((b) => !b.paid).reduce((s, b) => s + b.patient_pays, 0),
      insurance: billed.reduce((s, b) => s + b.insurance, 0),
    };

    return NextResponse.json({
      date: day,
      doctor_name_ar: account.name_ar,
      viewer_role: account.actor.role,
      visit_types: visitTypes,
      has_clinic: !!doctorRes.data?.tenant_id,
      consultation_fee_egp:
        doctorRes.data?.consultation_fee_egp != null ? num(doctorRes.data.consultation_fee_egp) : null,
      rows,
      stats,
    });
  } catch (err) {
    console.error('[doctor/today] GET failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

interface ActionBody {
  action?: 'check_in' | 'walk_in' | 'call_next' | 'call' | 'complete' | 'no_show';
  booking_id?: string;
  queue_id?: string;
  patient_name?: string;
  patient_phone?: string;
  chief_complaint?: string;
  visit_type_id?: string;
  locale?: Locale;
}

export async function POST(request: NextRequest) {
  let locale: Locale = 'ar';
  try {
    const body = (await request.json()) as ActionBody;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const account = await authenticateDoctorWorkspace(request);
    if (!account) {
      return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    }
    if (!account.doctor_id) {
      return NextResponse.json({ error: T.noProfile[locale] }, { status: 400 });
    }

    const doctorId = account.doctor_id;
    const supabase = getDoctorServiceClient();
    const day = cairoToday();
    const now = new Date().toISOString();

    /** A queue entry, only if it belongs to this doctor today. */
    async function ownQueueEntry(id: string | undefined): Promise<QueueRow | null> {
      if (!id) return null;
      const { data } = await supabase
        .from('clinic_queue')
        .select('*')
        .eq('id', id)
        .eq('doctor_id', doctorId)
        .eq('queue_date', day)
        .maybeSingle();
      return (data as QueueRow | null) ?? null;
    }

    /** A booking, only if it belongs to this doctor. */
    async function ownBooking(id: string | undefined) {
      if (!id) return null;
      const { data } = await supabase
        .from('bookings')
        .select('id, tenant_id, patient_id, status, patients(name_ar, phone_number)')
        .eq('id', id)
        .eq('doctor_id', doctorId)
        .maybeSingle();
      return data;
    }

    async function callEntry(entry: QueueRow) {
      const { data: updated, error } = await supabase
        .from('clinic_queue')
        .update({ status: 'called', called_at: now })
        .eq('id', entry.id)
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Notifications are best-effort: never fail the call because WhatsApp did.
      try {
        if (entry.patient_phone) {
          const { data: room } = await supabase
            .from('clinic_rooms')
            .select('name_ar')
            .eq('doctor_id', doctorId)
            .eq('tenant_id', entry.tenant_id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          await sendCalledNotification(entry.patient_phone, (room?.name_ar as string | undefined) ?? '');
        }
        const { data: upNext } = await supabase
          .from('clinic_queue')
          .select('patient_phone')
          .eq('doctor_id', doctorId)
          .eq('queue_date', day)
          .eq('status', 'waiting')
          .order('queue_number', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (upNext?.patient_phone) {
          await sendAlmostNextNotification(upNext.patient_phone as string);
        }
      } catch (err) {
        console.error('[doctor/today] queue notification failed:', err instanceof Error ? err.message : err);
      }

      return updated;
    }

    switch (body.action) {
      case 'check_in': {
        const booking = await ownBooking(body.booking_id);
        if (!booking) {
          return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
        }

        const { data: existing } = await supabase
          .from('clinic_queue')
          .select('id')
          .eq('booking_id', booking.id)
          .eq('queue_date', day)
          .limit(1)
          .maybeSingle();
        if (existing) {
          return NextResponse.json({ error: T.alreadyIn[locale] }, { status: 409 });
        }

        const tenantId = (booking.tenant_id as string | null) ?? (await primaryTenant(supabase, doctorId));
        if (!tenantId) {
          return NextResponse.json({ error: T.noClinic[locale] }, { status: 400 });
        }

        const patient = first(booking.patients as PatientEmbed | PatientEmbed[] | null);
        const entry = await enqueue(supabase, {
          tenant_id: tenantId,
          doctor_id: doctorId,
          queue_date: day,
          patient_id: (booking.patient_id as string | null) ?? null,
          patient_name_ar: patient?.name_ar || (locale === 'en' ? 'Patient' : 'مريض'),
          patient_phone: patient?.phone_number ?? null,
          source: 'online_booking',
          booking_id: booking.id as string,
        });

        if (booking.status === 'pending') {
          await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);
        }

        return NextResponse.json({ success: true, entry });
      }

      case 'walk_in': {
        // Only accept one of this doctor's own visit types.
        let walkInType: string | undefined;
        if (body.visit_type_id) {
          const { data: vt } = await supabase
            .from('doctor_visit_types')
            .select('id')
            .eq('id', body.visit_type_id)
            .eq('doctor_id', doctorId)
            .maybeSingle();
          walkInType = (vt?.id as string | undefined) ?? undefined;
        }
        const name = body.patient_name?.trim();
        if (!name) {
          return NextResponse.json({ error: T.nameRequired[locale] }, { status: 400 });
        }
        const tenantId = await primaryTenant(supabase, doctorId);
        if (!tenantId) {
          return NextResponse.json({ error: T.noClinic[locale] }, { status: 400 });
        }

        const entry = await enqueue(supabase, {
          tenant_id: tenantId,
          doctor_id: doctorId,
          queue_date: day,
          patient_name_ar: name,
          patient_phone: body.patient_phone?.trim() || null,
          source: 'walk_in',
          chief_complaint_ar: body.chief_complaint?.trim() || null,
          ...(walkInType ? { visit_type_id: walkInType } : {}),
        });

        return NextResponse.json({ success: true, entry });
      }

      case 'call_next': {
        const { data: next } = await supabase
          .from('clinic_queue')
          .select('*')
          .eq('doctor_id', doctorId)
          .eq('queue_date', day)
          .eq('status', 'waiting')
          .order('queue_number', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!next) {
          return NextResponse.json({ error: T.noneWaiting[locale] }, { status: 404 });
        }
        const entry = await callEntry(next as QueueRow);
        return NextResponse.json({ success: true, entry });
      }

      case 'call': {
        const entry = await ownQueueEntry(body.queue_id);
        if (!entry) {
          return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
        }
        const updated = await callEntry(entry);
        return NextResponse.json({ success: true, entry: updated });
      }

      case 'complete':
      case 'no_show': {
        const entry = await ownQueueEntry(body.queue_id);
        const bookingId = entry?.booking_id ?? body.booking_id;
        const booking = bookingId ? await ownBooking(bookingId) : null;
        if (!entry && !booking) {
          return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
        }

        if (entry) {
          const update: Record<string, unknown> = { status: body.action, completed_at: now };
          if (body.action === 'complete') {
            update.status = 'completed';
            if (entry.called_at) {
              update.wait_minutes_actual = Math.round(
                (new Date(entry.called_at).getTime() - new Date(entry.arrived_at).getTime()) / 60000
              );
            }
          }
          const { error } = await supabase.from('clinic_queue').update(update).eq('id', entry.id);
          if (error) throw new Error(error.message);
        }

        if (booking && booking.status !== 'completed' && booking.status !== 'cancelled') {
          await supabase
            .from('bookings')
            .update({
              status: body.action === 'complete' ? 'completed' : 'no_show',
              updated_at: now,
            })
            .eq('id', booking.id);
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: T.badAction[locale] }, { status: 400 });
    }
  } catch (err) {
    console.error('[doctor/today] POST failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

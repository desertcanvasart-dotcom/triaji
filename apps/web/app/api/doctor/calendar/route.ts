import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorWorkspace, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { fetchTimeOff } from '@/lib/time-off';

export const dynamic = 'force-dynamic';

/**
 * GET /api/doctor/calendar?month=YYYY-MM — one month of the signed-in doctor's
 * schedule: per day, the open/booked slots (and the hours they span), the
 * bookings, and any time off.
 *
 * Every timestamp involved is a floating clinic-local wall clock stored with a
 * `Z` (lib/slots.ts), so days are cut on UTC midnight and clock times are read
 * straight off the ISO string.
 */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'payment_pending';

interface PatientEmbed { name_ar: string | null }

export interface CalendarBooking {
  id: string;
  time: string;
  status: BookingStatus;
  patient_name: string | null;
  appointment_type: 'in_person' | 'telehealth';
}

export interface CalendarDay {
  date: string;
  open_slots: number;
  booked_slots: number;
  first_slot: string | null;
  last_slot: string | null;
  bookings: CalendarBooking[];
  time_off: { id: string; full_day: boolean; from: string; to: string; reason: string | null }[];
}

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  noProfile: { ar: 'حسابك لسه مش مربوط بملف طبيب', en: 'Your account is not linked to a doctor profile yet' },
  badMonth: { ar: 'الشهر غير صحيح', en: 'Invalid month' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

function first<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const clock = (iso: string) => iso.slice(11, 16);
const dateOf = (iso: string) => iso.slice(0, 10);

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  try {
    const account = await authenticateDoctorWorkspace(request);
    if (!account) {
      return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    }
    if (!account.doctor_id) {
      return NextResponse.json({ error: T.noProfile[locale] }, { status: 400 });
    }

    const match = MONTH_RE.exec(request.nextUrl.searchParams.get('month') ?? '');
    if (!match) {
      return NextResponse.json({ error: T.badMonth[locale] }, { status: 400 });
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const fromMs = Date.UTC(year, month - 1, 1);
    const toMs = Date.UTC(year, month, 1);
    const fromIso = new Date(fromMs).toISOString();
    const toIso = new Date(toMs).toISOString();

    const doctorId = account.doctor_id;
    const supabase = getDoctorServiceClient();

    const [slotsRes, bookingsRes, blocks] = await Promise.all([
      supabase
        .from('doctor_availability')
        .select('slot_datetime, is_booked')
        .eq('doctor_id', doctorId)
        .gte('slot_datetime', fromIso)
        .lt('slot_datetime', toIso)
        .order('slot_datetime', { ascending: true }),
      supabase
        .from('bookings')
        .select('id, appointment_datetime, appointment_type, status, patients(name_ar)')
        .eq('doctor_id', doctorId)
        .gte('appointment_datetime', fromIso)
        .lt('appointment_datetime', toIso)
        .order('appointment_datetime', { ascending: true }),
      fetchTimeOff(supabase, doctorId, fromIso, toIso),
    ]);

    if (slotsRes.error || bookingsRes.error) {
      console.error('[doctor/calendar] load failed:', slotsRes.error?.message ?? bookingsRes.error?.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    const days = new Map<string, CalendarDay>();
    for (let ms = fromMs; ms < toMs; ms += 86_400_000) {
      const date = new Date(ms).toISOString().slice(0, 10);
      days.set(date, {
        date,
        open_slots: 0,
        booked_slots: 0,
        first_slot: null,
        last_slot: null,
        bookings: [],
        time_off: [],
      });
    }

    for (const slot of (slotsRes.data ?? []) as { slot_datetime: string; is_booked: boolean }[]) {
      const day = days.get(dateOf(slot.slot_datetime));
      if (!day) continue;
      if (slot.is_booked) day.booked_slots++;
      else day.open_slots++;
      const t = clock(slot.slot_datetime);
      if (!day.first_slot || t < day.first_slot) day.first_slot = t;
      if (!day.last_slot || t > day.last_slot) day.last_slot = t;
    }

    const bookings = (bookingsRes.data ?? []) as unknown as {
      id: string;
      appointment_datetime: string;
      appointment_type: 'in_person' | 'telehealth' | null;
      status: BookingStatus;
      patients: PatientEmbed | PatientEmbed[] | null;
    }[];
    for (const b of bookings) {
      const day = days.get(dateOf(b.appointment_datetime));
      if (!day) continue;
      day.bookings.push({
        id: b.id,
        time: clock(b.appointment_datetime),
        status: b.status,
        patient_name: first(b.patients)?.name_ar ?? null,
        appointment_type: b.appointment_type ?? 'in_person',
      });
    }

    for (const block of blocks) {
      const bStart = new Date(block.starts_at).getTime();
      const bEnd = new Date(block.ends_at).getTime();
      for (const day of days.values()) {
        const dStart = new Date(`${day.date}T00:00:00.000Z`).getTime();
        const dEnd = dStart + 86_400_000;
        if (bStart >= dEnd || bEnd <= dStart) continue;
        const full = bStart <= dStart && bEnd >= dEnd;
        day.time_off.push({
          id: block.id,
          full_day: full,
          from: bStart <= dStart ? '00:00' : clock(new Date(bStart).toISOString()),
          to: bEnd >= dEnd ? '24:00' : clock(new Date(bEnd).toISOString()),
          reason: block.reason,
        });
      }
    }

    return NextResponse.json({
      month: `${match[1]}-${match[2]}`,
      days: Array.from(days.values()),
      viewer_role: account.actor.role,
    });
  } catch (err) {
    console.error('[doctor/calendar] GET failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

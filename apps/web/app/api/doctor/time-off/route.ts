import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { fetchTimeOff, isMissingTimeOffTable } from '@/lib/time-off';

export const dynamic = 'force-dynamic';

/**
 * POST /api/doctor/time-off — the signed-in doctor takes a day (or part of a
 * day) off. Body: { date: 'YYYY-MM-DD', from?: 'HH:MM', to?: 'HH:MM', reason? }.
 *
 * Mirrors the admin route (apps/admin/app/api/admin/doctors/[id]/time-off):
 * open slots inside the block disappear for patients (lib/time-off.ts) and come
 * back if it is removed; existing bookings are never touched — they're counted
 * and returned so the doctor can contact those patients.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  noProfile: { ar: 'حسابك لسه مش مربوط بملف طبيب', en: 'Your account is not linked to a doctor profile yet' },
  badDate: { ar: 'التاريخ غير صحيح', en: 'Invalid date' },
  badRange: { ar: 'وقت النهاية لازم يكون بعد البداية', en: 'End time must be after start time' },
  past: { ar: 'مينفعش تاخد إجازة في يوم فات', en: 'You can’t take time off in the past' },
  already: { ar: 'اليوم ده عندك فيه إجازة بالفعل', en: 'You already have time off then' },
  unavailable: {
    ar: 'الإجازات مش متاحة دلوقتي، تواصل مع الدعم',
    en: 'Time off is not available yet — contact support',
  },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

/** Today's date in Egypt — clinic-local, matching the floating timestamps. */
function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(request: NextRequest) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const account = await authenticateDoctorAccount(request, { requireVerified: true });
    if (!account) {
      return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    }
    if (!account.doctor_id) {
      return NextResponse.json({ error: T.noProfile[locale] }, { status: 400 });
    }

    const date = typeof body.date === 'string' ? body.date : '';
    const from = typeof body.from === 'string' && body.from ? body.from : null;
    const to = typeof body.to === 'string' && body.to ? body.to : null;
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      return NextResponse.json({ error: T.badDate[locale] }, { status: 400 });
    }
    if ((from && !TIME_RE.test(from)) || (to && !TIME_RE.test(to))) {
      return NextResponse.json({ error: T.badDate[locale] }, { status: 400 });
    }
    if (date < cairoToday()) {
      return NextResponse.json({ error: T.past[locale] }, { status: 400 });
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const startsAt = from ? new Date(`${date}T${from}:00.000Z`) : dayStart;
    const endsAt = to ? new Date(`${date}T${to}:00.000Z`) : new Date(dayStart.getTime() + 86_400_000);
    if (endsAt <= startsAt) {
      return NextResponse.json({ error: T.badRange[locale] }, { status: 400 });
    }

    const supabase = getDoctorServiceClient();
    const doctorId = account.doctor_id;

    const existing = await fetchTimeOff(supabase, doctorId, startsAt.toISOString(), endsAt.toISOString());
    if (existing.length > 0) {
      return NextResponse.json({ error: T.already[locale] }, { status: 409 });
    }

    const { data: doctor } = await supabase
      .from('doctors')
      .select('tenant_id')
      .eq('id', doctorId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('doctor_time_off')
      .insert({
        doctor_id: doctorId,
        tenant_id: (doctor?.tenant_id as string | null) ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 200) : null,
      })
      .select('id, starts_at, ends_at, reason')
      .single();

    if (error) {
      if (isMissingTimeOffTable(error)) {
        return NextResponse.json({ error: T.unavailable[locale] }, { status: 503 });
      }
      console.error('[doctor/time-off] create failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    // Bookings already inside the new block are kept — report them.
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_datetime', startsAt.toISOString())
      .lt('appointment_datetime', endsAt.toISOString());

    return NextResponse.json({ time_off: data, affected_bookings: count ?? 0 }, { status: 201 });
  } catch (err) {
    console.error('[doctor/time-off] POST failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

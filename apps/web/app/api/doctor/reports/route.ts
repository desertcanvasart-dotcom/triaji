import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import {
  addDays,
  buildDoctorReport,
  daysInRange,
  type ReportBooking,
  type ReportInvoice,
  type ReportQueueEntry,
} from '@/lib/doctor/reports';

export const dynamic = 'force-dynamic';

/**
 * GET /api/doctor/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Visits, no-shows and income for the signed-in doctor over a range of Cairo
 * days (at most a year). Doctor only — assistants don't see the clinic's money.
 */

const MAX_DAYS = 366;
const PAGE = 1000;

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  noProfile: { ar: 'حسابك لسه مش مربوط بملف طبيب', en: 'Your account is not linked to a doctor profile yet' },
  range: { ar: 'اختار فترة صحيحة (سنة كحد أقصى)', en: 'Pick a valid date range (up to one year)' },
  failed: { ar: 'تعذر تحميل التقرير', en: 'Could not load the report' },
} as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Read every page of a query (PostgREST caps responses at 1000 rows). */
async function fetchAll<R>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<R[]> {
  const rows: R[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await page(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as R[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locale = params.get('locale') === 'en' ? 'en' : 'ar';

  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  if (!account.doctor_id) return NextResponse.json({ error: T.noProfile[locale] }, { status: 400 });

  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  if (!DATE.test(from) || !DATE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return NextResponse.json({ error: T.range[locale] }, { status: 400 });
  }
  const days = daysInRange(from, to);
  if (days < 1 || days > MAX_DAYS) return NextResponse.json({ error: T.range[locale] }, { status: 400 });

  const doctorId = account.doctor_id;
  const supabase = getDoctorServiceClient();

  try {
    const [bookings, queue, invoices, typesRes] = await Promise.all([
      fetchAll<ReportBooking>((a, b) =>
        supabase
          .from('bookings')
          .select('id, appointment_datetime, appointment_type, status, patient_id, slot_id')
          .eq('doctor_id', doctorId)
          .gte('appointment_datetime', `${from}T00:00:00.000Z`)
          .lt('appointment_datetime', `${addDays(to, 1)}T00:00:00.000Z`)
          .order('appointment_datetime', { ascending: true })
          .range(a, b)
      ),
      // '*' so the report still loads if a column (e.g. visit_type_id) is missing.
      fetchAll<ReportQueueEntry>((a, b) =>
        supabase
          .from('clinic_queue')
          .select('*')
          .eq('doctor_id', doctorId)
          .gte('queue_date', from)
          .lte('queue_date', to)
          .order('id', { ascending: true })
          .range(a, b)
      ),
      fetchAll<ReportInvoice>((a, b) =>
        supabase
          .from('clinic_invoices')
          .select('*')
          .eq('doctor_id', doctorId)
          .gte('invoice_date', from)
          .lte('invoice_date', to)
          .order('id', { ascending: true })
          .range(a, b)
      ),
      supabase.from('doctor_visit_types').select('id, name').eq('doctor_id', doctorId),
    ]);

    // Bookings take the visit type of the slot they were booked into.
    const slotIds = [...new Set(bookings.map((b) => b.slot_id).filter(Boolean) as string[])];
    const slotVisitType = new Map<string, string | null>();
    for (let i = 0; i < slotIds.length; i += 200) {
      const { data } = await supabase
        .from('doctor_availability')
        .select('id, visit_type_id')
        .in('id', slotIds.slice(i, i + 200));
      for (const s of data ?? []) slotVisitType.set(s.id as string, (s.visit_type_id as string | null) ?? null);
    }

    const report = buildDoctorReport({
      from,
      to,
      bookings,
      queue,
      invoices,
      visitTypes: typesRes.error ? [] : ((typesRes.data ?? []) as { id: string; name: string }[]),
      slotVisitType,
    });
    return NextResponse.json(report);
  } catch (err) {
    console.error('[doctor/reports] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

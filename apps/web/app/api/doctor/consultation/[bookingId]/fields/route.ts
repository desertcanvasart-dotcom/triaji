import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { EXAM_FIELD_COLUMNS, normaliseValue, type ExamField } from '@/lib/doctor/exam-fields';

export const dynamic = 'force-dynamic';

/**
 * GET /api/doctor/consultation/[bookingId]/fields — the doctor's active exam
 *     fields (plus any archived field that has a value on this visit) and the
 *     values saved for this booking.
 * PUT — save values: { values: { [fieldId]: string | number | boolean | null } }.
 *     An empty value clears it. Only the booking's own doctor can do either.
 */

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  notFound: { ar: 'الحجز غير موجود', en: 'Booking not found' },
  invalid: { ar: 'فيه قيمة مش صحيحة', en: 'One of the values is not valid' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

async function context(request: NextRequest, bookingId: string) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account || !account.doctor_id) return { account: null, booking: null };
  const { data: booking } = await getDoctorServiceClient()
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('doctor_id', account.doctor_id)
    .maybeSingle();
  return { account, booking };
}

async function load(accountId: string, bookingId: string) {
  const supabase = getDoctorServiceClient();
  const [fieldsRes, valuesRes] = await Promise.all([
    supabase
      .from('doctor_exam_fields')
      .select(EXAM_FIELD_COLUMNS)
      .eq('doctor_account_id', accountId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('exam_field_values').select('field_id, value').eq('booking_id', bookingId),
  ]);
  const values: Record<string, string> = {};
  for (const v of (valuesRes.data ?? []) as { field_id: string; value: string }[]) values[v.field_id] = v.value;
  const fields = ((fieldsRes.data ?? []) as ExamField[]).filter((f) => f.is_active || f.id in values);
  return { fields, values, error: fieldsRes.error ?? valuesRes.error };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const { bookingId } = await params;
  const { account, booking } = await context(request, bookingId);
  if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  if (!booking) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

  const { fields, values, error } = await load(account.id, bookingId);
  if (error) {
    console.error('[consultation/fields] load failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
  return NextResponse.json({ fields, values });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const { bookingId } = await params;
    const body = (await request.json()) as { values?: Record<string, unknown>; locale?: string };
    locale = body.locale === 'en' ? 'en' : 'ar';

    const { account, booking } = await context(request, bookingId);
    if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    if (!booking) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

    const supabase = getDoctorServiceClient();
    const { data: own } = await supabase
      .from('doctor_exam_fields')
      .select(EXAM_FIELD_COLUMNS)
      .eq('doctor_account_id', account.id);
    const byId = new Map(((own ?? []) as ExamField[]).map((f) => [f.id, f]));

    const upserts: { booking_id: string; field_id: string; doctor_account_id: string; value: string; updated_at: string }[] = [];
    const clears: string[] = [];
    const now = new Date().toISOString();

    for (const [fieldId, raw] of Object.entries(body.values ?? {})) {
      const field = byId.get(fieldId);
      if (!field) continue; // not this doctor's field
      const { value, invalid } = normaliseValue(field, raw);
      if (invalid) return NextResponse.json({ error: T.invalid[locale], field_id: fieldId }, { status: 400 });
      if (value === null) clears.push(fieldId);
      else upserts.push({ booking_id: bookingId, field_id: fieldId, doctor_account_id: account.id, value, updated_at: now });
    }

    if (upserts.length > 0) {
      const { error } = await supabase.from('exam_field_values').upsert(upserts, { onConflict: 'booking_id,field_id' });
      if (error) throw new Error(error.message);
    }
    if (clears.length > 0) {
      const { error } = await supabase
        .from('exam_field_values')
        .delete()
        .eq('booking_id', bookingId)
        .in('field_id', clears);
      if (error) throw new Error(error.message);
    }

    const { fields, values } = await load(account.id, bookingId);
    return NextResponse.json({ success: true, fields, values });
  } catch (err) {
    console.error('[consultation/fields] PUT failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

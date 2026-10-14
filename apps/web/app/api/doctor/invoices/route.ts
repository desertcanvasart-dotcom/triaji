import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorWorkspace, getDoctorServiceClient } from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

/**
 * POST /api/doctor/invoices — bill a patient from the doctor's work-day screen.
 *
 * Body: { queue_id? | booking_id?, line_items: [{ description, qty, unit_price_egp }],
 *         discount_egp?, insurance_covered?, payment_method?, paid?, locale? }
 *
 * Writes the same clinic_invoices rows the clinic panel does (migration 034),
 * numbered per clinic by next_invoice_number, dated on the Cairo calendar day
 * so the Today screen picks them up. Open to the doctor and their assistants.
 */

const METHODS = ['cash', 'card', 'insurance', 'bank_transfer', 'partial_insurance'] as const;
type Method = (typeof METHODS)[number];
const MAX_ITEMS = 20;

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  noProfile: { ar: 'حسابك لسه مش مربوط بملف طبيب', en: 'Your account is not linked to a doctor profile yet' },
  notFound: { ar: 'المريض ده مش موجود في قايمتك', en: 'That patient is not on your list' },
  noClinic: { ar: 'لازم تربط عيادة بحسابك من الإعدادات الأول', en: 'Link a clinic to your account in Settings first' },
  items: { ar: 'أضف بند واحد على الأقل بسعر صحيح', en: 'Add at least one line with a valid price' },
  amounts: {
    ar: 'الخصم والتأمين مع بعض مينفعش يزيدوا عن الإجمالي',
    en: 'Discount plus insurance can’t exceed the total',
  },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const money = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};

export async function POST(request: NextRequest) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const body = (await request.json()) as Record<string, unknown>;
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

    // ── Who is being billed: a queue entry today, or one of the doctor's bookings ──
    const queueId = typeof body.queue_id === 'string' ? body.queue_id : null;
    const bookingIdIn = typeof body.booking_id === 'string' ? body.booking_id : null;

    let tenantId: string | null = null;
    let patientId: string | null = null;
    let patientName: string | null = null;
    let bookingId: string | null = bookingIdIn;

    if (queueId) {
      const { data: entry } = await supabase
        .from('clinic_queue')
        .select('tenant_id, patient_id, patient_name_ar, booking_id')
        .eq('id', queueId)
        .eq('doctor_id', doctorId)
        .maybeSingle();
      if (!entry) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
      tenantId = entry.tenant_id as string;
      patientId = (entry.patient_id as string | null) ?? null;
      patientName = (entry.patient_name_ar as string | null) ?? null;
      bookingId = (entry.booking_id as string | null) ?? bookingId;
    }

    if (bookingId && (!tenantId || !patientName)) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('tenant_id, patient_id, patients(name_ar)')
        .eq('id', bookingId)
        .eq('doctor_id', doctorId)
        .maybeSingle();
      if (!booking) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
      const patient = Array.isArray(booking.patients) ? booking.patients[0] : booking.patients;
      tenantId ??= (booking.tenant_id as string | null) ?? null;
      patientId ??= (booking.patient_id as string | null) ?? null;
      patientName ??= ((patient as { name_ar?: string | null } | null)?.name_ar as string | null) ?? null;
    }

    if (!queueId && !bookingId) {
      return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
    }

    if (!tenantId) {
      const { data: doctor } = await supabase.from('doctors').select('tenant_id').eq('id', doctorId).maybeSingle();
      tenantId = (doctor?.tenant_id as string | null) ?? null;
    }
    if (!tenantId) {
      return NextResponse.json({ error: T.noClinic[locale] }, { status: 400 });
    }

    // ── Amounts ──
    const rawItems = Array.isArray(body.line_items) ? body.line_items.slice(0, MAX_ITEMS) : [];
    const items = rawItems
      .map((raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const qty = Math.floor(Number(r.qty));
        const price = money(r.unit_price_egp);
        const description = typeof r.description === 'string' ? r.description.trim().slice(0, 120) : '';
        return { description, qty, unit_price_egp: price };
      })
      .filter((i) => i.description && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99 && Number.isFinite(i.unit_price_egp));
    if (items.length === 0 || items.length !== rawItems.length) {
      return NextResponse.json({ error: T.items[locale] }, { status: 400 });
    }

    const subtotal = Math.round(items.reduce((sum, i) => sum + i.qty * i.unit_price_egp, 0) * 100) / 100;
    const discount = body.discount_egp == null || body.discount_egp === '' ? 0 : money(body.discount_egp);
    const insurance = body.insurance_covered == null || body.insurance_covered === '' ? 0 : money(body.insurance_covered);
    if (!Number.isFinite(discount) || !Number.isFinite(insurance) || discount + insurance > subtotal) {
      return NextResponse.json({ error: T.amounts[locale] }, { status: 400 });
    }
    const patientPays = Math.round((subtotal - discount - insurance) * 100) / 100;

    const method: Method | null = METHODS.includes(body.payment_method as Method) ? (body.payment_method as Method) : null;
    const paid = body.paid === true;

    const now = new Date().toISOString();
    // Numbers are unique per clinic; retry once if another invoice took ours.
    let invoice: { id: string; invoice_number: string; patient_pays_egp: number; status: string } | null = null;
    let error: { code?: string; message: string } | null = null;
    for (let tries = 0; tries < 2; tries++) {
      const { data: invoiceNumber, error: rpcError } = await supabase.rpc('next_invoice_number', {
        p_tenant_id: tenantId,
      });
      if (rpcError) throw new Error(rpcError.message);

      const attempt = await supabase
        .from('clinic_invoices')
        .insert({
          tenant_id: tenantId,
          queue_entry_id: queueId,
          booking_id: bookingId,
          patient_id: patientId,
          patient_name_ar: patientName || (locale === 'en' ? 'Patient' : 'مريض'),
          doctor_id: doctorId,
          invoice_date: day,
          invoice_number: invoiceNumber as string,
          line_items: items,
          subtotal_egp: subtotal,
          discount_egp: discount,
          insurance_covered: insurance,
          patient_pays_egp: patientPays,
          status: paid ? 'paid' : 'issued',
          payment_method: method ?? (paid ? 'cash' : null),
          paid_at: paid ? now : null,
          notes_ar:
            account.actor.role === 'assistant'
              ? `${locale === 'en' ? 'Issued by assistant' : 'أصدرها المساعد'}: ${account.actor.name}`
              : null,
        })
        .select('id, invoice_number, patient_pays_egp, status')
        .single();

      invoice = attempt.data as typeof invoice;
      error = attempt.error;
      if (!error || error.code !== '23505') break;
    }

    if (error) {
      console.error('[doctor/invoices] create failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (err) {
    console.error('[doctor/invoices] POST failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

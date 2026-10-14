import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorWorkspace, getDoctorServiceClient } from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/doctor/invoices/[id] — record payment for one of the doctor's
 * invoices: { paid: true, payment_method? }. Open to the doctor and their
 * assistants, like the rest of the front desk.
 */

const METHODS = ['cash', 'card', 'insurance', 'bank_transfer', 'partial_insurance'] as const;

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  notFound: { ar: 'الفاتورة دي مش موجودة', en: 'Invoice not found' },
  already: { ar: 'الفاتورة دي مدفوعة بالفعل', en: 'This invoice is already paid' },
  cancelled: { ar: 'الفاتورة دي ملغية', en: 'This invoice was cancelled' },
  bad: { ar: 'طلب غير صالح', en: 'Invalid request' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const account = await authenticateDoctorWorkspace(request);
    if (!account || !account.doctor_id) {
      return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    }
    if (body.paid !== true) {
      return NextResponse.json({ error: T.bad[locale] }, { status: 400 });
    }

    const supabase = getDoctorServiceClient();
    const { data: invoice } = await supabase
      .from('clinic_invoices')
      .select('id, status, payment_method')
      .eq('id', id)
      .eq('doctor_id', account.doctor_id)
      .maybeSingle();
    if (!invoice) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
    if (invoice.status === 'paid') return NextResponse.json({ error: T.already[locale] }, { status: 409 });
    if (invoice.status === 'cancelled') return NextResponse.json({ error: T.cancelled[locale] }, { status: 409 });

    const method = METHODS.includes(body.payment_method as (typeof METHODS)[number])
      ? (body.payment_method as string)
      : ((invoice.payment_method as string | null) ?? 'cash');

    const { data, error } = await supabase
      .from('clinic_invoices')
      .update({ status: 'paid', payment_method: method, paid_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'paid')
      .select('id, invoice_number, status')
      .single();

    if (error) {
      console.error('[doctor/invoices] pay failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    return NextResponse.json({ success: true, invoice: data });
  } catch (err) {
    console.error('[doctor/invoices] PATCH failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDoctorAccount,
  authenticateDoctorWorkspace,
  getDoctorServiceClient,
} from '@/lib/auth/doctor-account';
import { toVisitType } from '@/lib/doctor/visit-types';

export const dynamic = 'force-dynamic';

/**
 * The doctor's visit types (migration 075) with their prices (migration 079).
 *
 * GET  — doctor or assistant (the front desk picks a type for walk-ins and invoices).
 * POST — doctor only: { name, price_egp?, duration_minutes?, is_default? }.
 */

const MAX_TYPES = 15;

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  noProfile: { ar: 'حسابك لسه مش مربوط بملف طبيب', en: 'Your account is not linked to a doctor profile yet' },
  name: { ar: 'اكتب اسم نوع الكشف', en: 'Name the visit type' },
  price: { ar: 'السعر لازم يكون رقم موجب', en: 'Price must be a positive number' },
  duration: { ar: 'المدة لازم تكون بين 5 و 240 دقيقة', en: 'Duration must be between 5 and 240 minutes' },
  limit: { ar: `الحد الأقصى ${MAX_TYPES} نوع`, en: `You can have up to ${MAX_TYPES} visit types` },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const account = await authenticateDoctorWorkspace(request);
  if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  if (!account.doctor_id) return NextResponse.json({ visit_types: [], default_fee_egp: null });

  const supabase = getDoctorServiceClient();
  const [typesRes, doctorRes] = await Promise.all([
    supabase
      .from('doctor_visit_types')
      .select('*')
      .eq('doctor_id', account.doctor_id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase.from('doctors').select('consultation_fee_egp').eq('id', account.doctor_id).maybeSingle(),
  ]);

  if (typesRes.error) {
    console.error('[visit-types] list failed:', typesRes.error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }

  const fee = doctorRes.data?.consultation_fee_egp;
  return NextResponse.json({
    visit_types: (typesRes.data ?? []).map((r) => toVisitType(r as Record<string, unknown>)),
    default_fee_egp: fee == null ? null : Number(fee),
  });
}

export async function POST(request: NextRequest) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const account = await authenticateDoctorAccount(request, { requireVerified: true });
    if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    if (!account.doctor_id) return NextResponse.json({ error: T.noProfile[locale] }, { status: 400 });

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
    if (!name) return NextResponse.json({ error: T.name[locale] }, { status: 400 });

    const price = body.price_egp === '' || body.price_egp == null ? null : Number(body.price_egp);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      return NextResponse.json({ error: T.price[locale] }, { status: 400 });
    }
    const duration = body.duration_minutes == null || body.duration_minutes === '' ? 30 : Number(body.duration_minutes);
    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      return NextResponse.json({ error: T.duration[locale] }, { status: 400 });
    }

    const supabase = getDoctorServiceClient();
    const { count } = await supabase
      .from('doctor_visit_types')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', account.doctor_id);
    if ((count ?? 0) >= MAX_TYPES) return NextResponse.json({ error: T.limit[locale] }, { status: 400 });

    // The first type becomes the default; otherwise only when asked (one default per doctor).
    const isDefault = (count ?? 0) === 0 || body.is_default === true;
    if (isDefault) {
      await supabase
        .from('doctor_visit_types')
        .update({ is_default: false })
        .eq('doctor_id', account.doctor_id)
        .eq('is_default', true);
    }

    const { data: doctor } = await supabase.from('doctors').select('tenant_id').eq('id', account.doctor_id).maybeSingle();

    const { data, error } = await supabase
      .from('doctor_visit_types')
      .insert({
        doctor_id: account.doctor_id,
        tenant_id: (doctor?.tenant_id as string | null) ?? null,
        name,
        price_egp: price === null ? null : Math.round(price * 100) / 100,
        duration_minutes: duration,
        is_default: isDefault,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[visit-types] create failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }
    return NextResponse.json({ visit_type: toVisitType(data as Record<string, unknown>) }, { status: 201 });
  } catch (err) {
    console.error('[visit-types] POST failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

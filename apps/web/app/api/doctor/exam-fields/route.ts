import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { EXAM_FIELD_COLUMNS, MAX_EXAM_FIELDS, fieldFromBody } from '@/lib/doctor/exam-fields';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/doctor/exam-fields — the doctor's custom exam fields (active first,
 *      then archived), in their display order.
 * POST /api/doctor/exam-fields — add one: { label, field_type, options?, unit?, is_required? }.
 */

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  label: { ar: 'اكتب اسم الحقل', en: 'Give the field a name' },
  type: { ar: 'نوع الحقل غير صحيح', en: 'Invalid field type' },
  options: { ar: 'الاختيارات لازم تكون اتنين على الأقل', en: 'A choice list needs at least two options' },
  limit: {
    ar: `وصلت للحد الأقصى (${MAX_EXAM_FIELDS} حقل). أرشف حقل قديم الأول.`,
    en: `You can have up to ${MAX_EXAM_FIELDS} fields. Archive an old one first.`,
  },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account) {
    return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  }

  const { data, error } = await getDoctorServiceClient()
    .from('doctor_exam_fields')
    .select(EXAM_FIELD_COLUMNS)
    .eq('doctor_account_id', account.id)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[exam-fields] list failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }

  return NextResponse.json({ fields: data ?? [] });
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

    const parsed = fieldFromBody(body, false);
    if (!parsed.ok) {
      return NextResponse.json({ error: T[parsed.error][locale] }, { status: 400 });
    }

    const supabase = getDoctorServiceClient();
    const { count } = await supabase
      .from('doctor_exam_fields')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_account_id', account.id)
      .eq('is_active', true);
    if ((count ?? 0) >= MAX_EXAM_FIELDS) {
      return NextResponse.json({ error: T.limit[locale] }, { status: 400 });
    }

    const { data: last } = await supabase
      .from('doctor_exam_fields')
      .select('sort_order')
      .eq('doctor_account_id', account.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('doctor_exam_fields')
      .insert({
        ...parsed.fields,
        doctor_account_id: account.id,
        sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
        is_active: true,
      })
      .select(EXAM_FIELD_COLUMNS)
      .single();

    if (error) {
      console.error('[exam-fields] create failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    return NextResponse.json({ field: data }, { status: 201 });
  } catch (err) {
    console.error('[exam-fields] POST failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { EXAM_FIELD_COLUMNS, fieldFromBody } from '@/lib/doctor/exam-fields';

export const dynamic = 'force-dynamic';

/**
 * PATCH  /api/doctor/exam-fields/[id] — rename, change options/unit/required,
 *        reorder (sort_order) or archive/restore (is_active).
 * DELETE /api/doctor/exam-fields/[id] — delete; a field that already holds
 *        values on past visits is archived instead so that data is kept.
 */

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  notFound: { ar: 'الحقل ده مش موجود', en: 'Field not found' },
  label: { ar: 'اكتب اسم الحقل', en: 'Give the field a name' },
  type: { ar: 'نوع الحقل غير صحيح', en: 'Invalid field type' },
  options: { ar: 'الاختيارات لازم تكون اتنين على الأقل', en: 'A choice list needs at least two options' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

async function ownField(request: NextRequest, id: string) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account) return { account: null, field: null };
  const { data: field } = await getDoctorServiceClient()
    .from('doctor_exam_fields')
    .select('id, field_type')
    .eq('id', id)
    .eq('doctor_account_id', account.id)
    .maybeSingle();
  return { account, field };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const { account, field } = await ownField(request, id);
    if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    if (!field) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

    // The type is fixed once created — stored values are interpreted by it.
    delete body.field_type;
    const parsed = fieldFromBody(
      field.field_type === 'select' && 'options' in body ? { ...body, field_type: 'select' } : body,
      true
    );
    if (!parsed.ok) return NextResponse.json({ error: T[parsed.error][locale] }, { status: 400 });
    delete parsed.fields.field_type;

    const { data, error } = await getDoctorServiceClient()
      .from('doctor_exam_fields')
      .update(parsed.fields)
      .eq('id', id)
      .select(EXAM_FIELD_COLUMNS)
      .single();

    if (error) {
      console.error('[exam-fields] update failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }
    return NextResponse.json({ field: data });
  } catch (err) {
    console.error('[exam-fields] PATCH failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const { id } = await params;

  const { account, field } = await ownField(request, id);
  if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  if (!field) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

  const supabase = getDoctorServiceClient();
  const { count } = await supabase
    .from('exam_field_values')
    .select('field_id', { count: 'exact', head: true })
    .eq('field_id', id);

  const { error } =
    (count ?? 0) > 0
      ? await supabase.from('doctor_exam_fields').update({ is_active: false }).eq('id', id)
      : await supabase.from('doctor_exam_fields').delete().eq('id', id);

  if (error) {
    console.error('[exam-fields] delete failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }

  return NextResponse.json({ success: true, archived: (count ?? 0) > 0 });
}

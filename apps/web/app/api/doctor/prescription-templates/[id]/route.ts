import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { TEMPLATE_COLUMNS, templateFromBody } from '@/lib/doctor/prescription-templates';

export const dynamic = 'force-dynamic';

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  notFound: { ar: 'القالب ده مش موجود', en: 'Template not found' },
  nameRequired: { ar: 'اكتب اسم للقالب', en: 'Give the template a name' },
  noMedications: { ar: 'القالب لازم يكون فيه دواء واحد على الأقل', en: 'A template needs at least one medication' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

type Locale = 'ar' | 'en';

/**
 * PATCH /api/doctor/prescription-templates/[id]
 *   { used: true }          — record that the template was applied (ranking)
 *   { name, medications, … } — overwrite the template's content
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let locale: Locale = 'ar';
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const account = await authenticateDoctorAccount(request, { requireVerified: true });
    if (!account) {
      return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    }

    const supabase = getDoctorServiceClient();
    const { data: current } = await supabase
      .from('prescription_templates')
      .select('id, use_count')
      .eq('id', id)
      .eq('doctor_account_id', account.id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
    }

    let update: Record<string, unknown>;
    if (body.used === true) {
      update = { use_count: (current.use_count as number) + 1, last_used_at: new Date().toISOString() };
    } else {
      const fields = templateFromBody(body);
      if (!fields.name) {
        return NextResponse.json({ error: T.nameRequired[locale] }, { status: 400 });
      }
      if (fields.medications.length === 0) {
        return NextResponse.json({ error: T.noMedications[locale] }, { status: 400 });
      }
      update = { ...fields, updated_at: new Date().toISOString() };
    }

    const { data, error } = await supabase
      .from('prescription_templates')
      .update(update)
      .eq('id', id)
      .eq('doctor_account_id', account.id)
      .select(TEMPLATE_COLUMNS)
      .single();

    if (error) {
      console.error('[prescription-templates] update failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (err) {
    console.error('[prescription-templates] PATCH failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

/** DELETE /api/doctor/prescription-templates/[id] */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const locale: Locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const { id } = await params;

  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account) {
    return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  }

  const { data, error } = await getDoctorServiceClient()
    .from('prescription_templates')
    .delete()
    .eq('id', id)
    .eq('doctor_account_id', account.id)
    .select('id');

  if (error) {
    console.error('[prescription-templates] delete failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

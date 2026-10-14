import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import {
  MAX_TEMPLATES_PER_DOCTOR,
  TEMPLATE_COLUMNS,
  templateFromBody,
} from '@/lib/doctor/prescription-templates';

export const dynamic = 'force-dynamic';

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  nameRequired: { ar: 'اكتب اسم للقالب', en: 'Give the template a name' },
  noMedications: { ar: 'القالب لازم يكون فيه دواء واحد على الأقل', en: 'A template needs at least one medication' },
  tooMany: { ar: 'وصلت للحد الأقصى من القوالب، امسح قالب قديم الأول', en: 'Template limit reached — delete an old one first' },
  duplicate: { ar: 'عندك قالب بنفس الاسم ده', en: 'You already have a template with that name' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

type Locale = 'ar' | 'en';

/** GET /api/doctor/prescription-templates — the doctor's templates, most used first */
export async function GET(request: NextRequest) {
  const locale: Locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account) {
    return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  }

  const { data, error } = await getDoctorServiceClient()
    .from('prescription_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('doctor_account_id', account.id)
    .order('use_count', { ascending: false })
    .order('name', { ascending: true })
    .limit(MAX_TEMPLATES_PER_DOCTOR);

  if (error) {
    console.error('[prescription-templates] list failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

/** POST /api/doctor/prescription-templates — save the current prescription as a template */
export async function POST(request: NextRequest) {
  let locale: Locale = 'ar';
  try {
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const account = await authenticateDoctorAccount(request, { requireVerified: true });
    if (!account) {
      return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    }

    const fields = templateFromBody(body);
    if (!fields.name) {
      return NextResponse.json({ error: T.nameRequired[locale] }, { status: 400 });
    }
    if (fields.medications.length === 0) {
      return NextResponse.json({ error: T.noMedications[locale] }, { status: 400 });
    }

    const supabase = getDoctorServiceClient();

    const { count } = await supabase
      .from('prescription_templates')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_account_id', account.id);
    if ((count ?? 0) >= MAX_TEMPLATES_PER_DOCTOR) {
      return NextResponse.json({ error: T.tooMany[locale] }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('prescription_templates')
      .select('id')
      .eq('doctor_account_id', account.id)
      // Case-insensitive exact match: escape LIKE wildcards in the typed name.
      .ilike('name', fields.name.replace(/[\\%_]/g, '\\$&'))
      .limit(1)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: T.duplicate[locale] }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('prescription_templates')
      .insert({ ...fields, name: fields.name, doctor_account_id: account.id })
      .select(TEMPLATE_COLUMNS)
      .single();

    if (error) {
      console.error('[prescription-templates] create failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err) {
    console.error('[prescription-templates] POST failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

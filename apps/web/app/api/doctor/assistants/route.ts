import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

/**
 * The signed-in doctor's assistants (migration 077).
 *
 * GET  — list them.
 * POST — create one: { name, email, password, phone? }. The doctor sets the
 *        password and hands it over (email/SMS delivery isn't relied on). The
 *        assistant signs in on the doctor login page and only reaches the
 *        front-desk screens (see authenticateDoctorWorkspace).
 */

const MAX_ASSISTANTS = 2;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  noProfile: { ar: 'حسابك لسه مش مربوط بملف طبيب', en: 'Your account is not linked to a doctor profile yet' },
  name: { ar: 'اكتب اسم المساعد', en: 'Enter the assistant’s name' },
  email: { ar: 'البريد الإلكتروني مش صحيح', en: 'Invalid email address' },
  password: { ar: 'كلمة المرور لازم تكون 8 حروف على الأقل', en: 'Password must be at least 8 characters' },
  limit: {
    ar: `تقدر تضيف ${MAX_ASSISTANTS} مساعدين بس. امسح واحد الأول.`,
    en: `You can have up to ${MAX_ASSISTANTS} assistants. Remove one first.`,
  },
  taken: { ar: 'البريد ده مستخدم في حساب تاني', en: 'That email is already used by another account' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

const COLUMNS = 'id, name, email, phone, is_active, last_login_at, created_at';

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account) {
    return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  }

  const { data, error } = await getDoctorServiceClient()
    .from('doctor_assistants')
    .select(COLUMNS)
    .eq('doctor_account_id', account.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[doctor/assistants] list failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }

  return NextResponse.json({ assistants: data ?? [], max: MAX_ASSISTANTS });
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

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim().slice(0, 20) : null;

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: T.name[locale] }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: T.email[locale] }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: T.password[locale] }, { status: 400 });
    }

    const supabase = getDoctorServiceClient();

    const { count } = await supabase
      .from('doctor_assistants')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_account_id', account.id);
    if ((count ?? 0) >= MAX_ASSISTANTS) {
      return NextResponse.json({ error: T.limit[locale] }, { status: 400 });
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'doctor_assistant', name },
    });
    if (createError || !created.user) {
      const taken = /already|registered|exists/i.test(createError?.message ?? '');
      if (!taken) console.error('[doctor/assistants] auth user failed:', createError?.message);
      return NextResponse.json({ error: taken ? T.taken[locale] : T.failed[locale] }, { status: taken ? 409 : 500 });
    }

    const { data, error } = await supabase
      .from('doctor_assistants')
      .insert({
        id: created.user.id,
        doctor_account_id: account.id,
        doctor_id: account.doctor_id,
        name,
        email,
        phone,
      })
      .select(COLUMNS)
      .single();

    if (error) {
      // Don't leave an orphan login behind.
      await supabase.auth.admin.deleteUser(created.user.id);
      console.error('[doctor/assistants] insert failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }

    return NextResponse.json({ assistant: data }, { status: 201 });
  } catch (err) {
    console.error('[doctor/assistants] POST failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

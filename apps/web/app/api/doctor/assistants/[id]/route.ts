import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

/**
 * PATCH  /api/doctor/assistants/[id] — { is_active?: boolean, password?: string }
 * DELETE /api/doctor/assistants/[id] — remove the assistant and their login.
 * Only the doctor who owns the assistant can do either.
 */

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  notFound: { ar: 'المساعد ده مش موجود', en: 'Assistant not found' },
  password: { ar: 'كلمة المرور لازم تكون 8 حروف على الأقل', en: 'Password must be at least 8 characters' },
  nothing: { ar: 'مفيش تعديل', en: 'Nothing to change' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

const COLUMNS = 'id, name, email, phone, is_active, last_login_at, created_at';

async function ownAssistant(request: NextRequest, id: string) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account) return { account: null, assistant: null };
  const { data: assistant } = await getDoctorServiceClient()
    .from('doctor_assistants')
    .select('id')
    .eq('id', id)
    .eq('doctor_account_id', account.id)
    .maybeSingle();
  return { account, assistant };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const { account, assistant } = await ownAssistant(request, id);
    if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    if (!assistant) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

    const supabase = getDoctorServiceClient();
    const hasActive = typeof body.is_active === 'boolean';
    const password = typeof body.password === 'string' ? body.password : null;
    if (!hasActive && password === null) {
      return NextResponse.json({ error: T.nothing[locale] }, { status: 400 });
    }

    if (password !== null) {
      if (password.length < 8) {
        return NextResponse.json({ error: T.password[locale] }, { status: 400 });
      }
      const { error } = await supabase.auth.admin.updateUserById(id, { password });
      if (error) {
        console.error('[doctor/assistants] password reset failed:', error.message);
        return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
      }
    }

    if (hasActive) {
      const { error } = await supabase
        .from('doctor_assistants')
        .update({ is_active: body.is_active })
        .eq('id', id);
      if (error) {
        console.error('[doctor/assistants] update failed:', error.message);
        return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
      }
      // Takes effect immediately: every front-desk request re-checks is_active.
    }

    const { data } = await supabase.from('doctor_assistants').select(COLUMNS).eq('id', id).single();
    return NextResponse.json({ assistant: data });
  } catch (err) {
    console.error('[doctor/assistants] PATCH failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const { id } = await params;

  const { account, assistant } = await ownAssistant(request, id);
  if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  if (!assistant) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

  // Deleting the auth user cascades to the doctor_assistants row.
  const { error } = await getDoctorServiceClient().auth.admin.deleteUser(id);
  if (error) {
    console.error('[doctor/assistants] delete failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

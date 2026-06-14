import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface LoginBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبين' },
        { status: 400 }
      );
    }

    const anonClient = getAnonClient();

    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (authError) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    const serviceClient = getServiceClient();

    const { data: doctorAccount, error: doctorError } = await serviceClient
      .from('doctor_accounts')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (doctorError || !doctorAccount) {
      return NextResponse.json(
        { error: 'هذا الحساب غير مسجل كطبيب' },
        { status: 403 }
      );
    }

    // Update last_login_at
    await serviceClient
      .from('doctor_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', authData.user.id);

    const response = NextResponse.json({
      user: authData.user,
      doctorAccount,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
    });

    response.cookies.set('sb-access-token', authData.session.access_token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });

    response.cookies.set('sb-refresh-token', authData.session.refresh_token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

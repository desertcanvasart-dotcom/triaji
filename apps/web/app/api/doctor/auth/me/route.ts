import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieToken = request.cookies.get('sb-access-token')?.value;
  return cookieToken || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);

    if (!token) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const supabase = getServiceClient();

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى' },
        { status: 401 }
      );
    }

    const { data: doctorAccount, error: doctorError } = await supabase
      .from('doctor_accounts')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (doctorError || !doctorAccount) {
      // An assistant works inside their doctor's portal (migration 077).
      const { data: assistant } = await supabase
        .from('doctor_assistants')
        .select('id, name, is_active, doctor_account_id')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (assistant?.is_active) {
        // Only what the portal shell needs — not the doctor's whole account.
        const { data: parent } = await supabase
          .from('doctor_accounts')
          .select('id, name_ar, name_en, specialty_ar, verification_status')
          .eq('id', assistant.doctor_account_id)
          .maybeSingle();
        if (parent?.verification_status === 'verified') {
          return NextResponse.json({
            doctorAccount: parent,
            role: 'assistant',
            assistant: { id: assistant.id, name: assistant.name },
          });
        }
      }

      return NextResponse.json(
        { error: 'هذا الحساب غير مسجل كطبيب' },
        { status: 403 }
      );
    }

    return NextResponse.json({ doctorAccount, role: 'doctor' });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

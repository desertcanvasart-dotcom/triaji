import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  last_login_at: string | null;
}

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticateDoctor(request: NextRequest): Promise<DoctorAccount | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

export async function GET(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);

    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const supabase = getServiceClient();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        appointment_datetime,
        appointment_type,
        status,
        patients!inner(phone_number, name_ar),
        triage_sessions(
          session_summaries(chief_complaint_ar, urgency_level, specialty_name_ar)
        )
      `)
      .eq('doctor_id', doctorAccount.doctor_id)
      .in('status', ['confirmed', 'pending'])
      .gte('appointment_datetime', twoHoursAgo)
      .order('appointment_datetime', { ascending: true })
      .limit(50);

    if (bookingsError) {
      return NextResponse.json(
        { error: 'فشل في جلب المواعيد' },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings: bookings ?? [] });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

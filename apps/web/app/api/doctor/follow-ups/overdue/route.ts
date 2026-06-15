import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

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

// ─── GET /api/doctor/follow-ups/overdue ───────────────────────────────────────
// Returns the doctor's overdue follow-ups with patient info.
export async function GET(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const supabase = getServiceClient();

    const { data: overdueFollowUps, error } = await supabase
      .from('follow_up_schedule')
      .select(`
        id,
        patient_id,
        follow_up_date,
        reason_ar,
        reason_en,
        status,
        overdue_alert_sent,
        created_at,
        patients!inner(name_ar, phone_number, preferred_language)
      `)
      .eq('doctor_account_id', doctorAccount.id)
      .eq('status', 'overdue')
      .order('follow_up_date', { ascending: true });

    if (error) {
      console.error('[follow-ups/overdue] Query error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch overdue follow-ups' }, { status: 500 });
    }

    const results = (overdueFollowUps ?? []).map((fu: Record<string, unknown>) => {
      const patients = fu.patients as { name_ar: string; phone_number: string; preferred_language: string | null } | null;
      const followUpDate = fu.follow_up_date as string;
      const daysOverdue = Math.floor(
        (Date.now() - new Date(followUpDate).getTime()) / 86400000
      );

      return {
        id: fu.id,
        patientId: fu.patient_id,
        patientName: patients?.name_ar ?? 'غير معروف',
        patientPhone: patients?.phone_number ?? '',
        followUpDate,
        reasonAr: fu.reason_ar,
        reasonEn: fu.reason_en,
        daysOverdue,
        overdueAlertSent: fu.overdue_alert_sent,
        createdAt: fu.created_at,
      };
    });

    return NextResponse.json({
      followUps: results,
      total: results.length,
    });
  } catch (err) {
    console.error('[follow-ups/overdue] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

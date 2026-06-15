import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOverdueReminder } from '@/lib/followup/notifications';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
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

// ─── POST /api/doctor/follow-ups/[id]/contact ────────────────────────────────
// Sends a WhatsApp reminder to the patient for an overdue follow-up.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const { id: followUpId } = await params;
    const supabase = getServiceClient();

    // Fetch the follow-up and verify ownership
    const { data: followUp, error: fuError } = await supabase
      .from('follow_up_schedule')
      .select('*, patients!inner(phone_number, name_ar, patient_profiles(preferred_language))')
      .eq('id', followUpId)
      .eq('doctor_account_id', doctorAccount.id)
      .single();

    if (fuError || !followUp) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    const patient = followUp.patients as {
      phone_number: string;
      name_ar: string;
      patient_profiles: { preferred_language: string | null }[] | null;
    };
    const patientLang = patient.patient_profiles?.[0]?.preferred_language ?? 'ar';

    // Send WhatsApp reminder
    const result = await sendOverdueReminder(
      patient.phone_number,
      patientLang,
      {
        doctorName: doctorAccount.name_ar,
        followUpDate: followUp.follow_up_date,
        reasonAr: followUp.reason_ar ?? '',
        patientName: patient.name_ar,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send WhatsApp message', details: result.error },
        { status: 502 }
      );
    }

    // Mark overdue alert as sent
    await supabase
      .from('follow_up_schedule')
      .update({ overdue_alert_sent: true })
      .eq('id', followUpId);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[follow-ups/contact] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

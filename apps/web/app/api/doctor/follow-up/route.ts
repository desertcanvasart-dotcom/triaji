import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
}

interface FollowUpBody {
  patient_id: string;
  booking_id?: string;
  health_record_id?: string;
  follow_up_date: string; // YYYY-MM-DD
  reason_ar: string;
  reason_en?: string;
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

// ─── POST /api/doctor/follow-up ───────────────────────────────────────────────
// Doctor creates a follow-up schedule for a patient.
export async function POST(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const body = (await request.json()) as FollowUpBody;

    // Validate required fields
    if (!body.patient_id || !body.follow_up_date || !body.reason_ar) {
      return NextResponse.json(
        { error: 'patient_id, follow_up_date, and reason_ar are required' },
        { status: 400 }
      );
    }

    // Validate date is in the future
    const followUpDate = new Date(body.follow_up_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (followUpDate < today) {
      return NextResponse.json(
        { error: 'follow_up_date must be in the future' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Check patient exists
    const { data: patient } = await supabase
      .from('patients')
      .select('id, phone_number, patient_profiles(preferred_language)')
      .eq('id', body.patient_id)
      .single();

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const patientLang =
      (patient.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
        ?.preferred_language ?? 'ar';

    // Check for duplicate follow-up on same date by same doctor
    const { data: existing } = await supabase
      .from('follow_up_schedule')
      .select('id')
      .eq('patient_id', body.patient_id)
      .eq('doctor_account_id', doctorAccount.id)
      .eq('follow_up_date', body.follow_up_date)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Follow-up already scheduled for this date' },
        { status: 409 }
      );
    }

    // Create follow-up record
    const { data: followUp, error: insertError } = await supabase
      .from('follow_up_schedule')
      .insert({
        patient_id: body.patient_id,
        doctor_id: doctorAccount.doctor_id,
        doctor_account_id: doctorAccount.id,
        booking_id: body.booking_id ?? null,
        health_record_id: body.health_record_id ?? null,
        follow_up_date: body.follow_up_date,
        reason_ar: body.reason_ar,
        reason_en: body.reason_en ?? null,
        source: 'doctor_picker',
        status: 'scheduled',
      })
      .select('id, follow_up_date, reason_ar, status')
      .single();

    if (insertError || !followUp) {
      console.error('[follow-up/POST] Insert error:', insertError?.message);
      return NextResponse.json({ error: 'Failed to create follow-up' }, { status: 500 });
    }

    // Send WhatsApp notification asynchronously (don't block response)
    sendFollowUpNotificationAsync(
      patient.phone_number,
      patientLang,
      {
        doctorName: doctorAccount.name_ar,
        followUpDate: body.follow_up_date,
        reasonAr: body.reason_ar,
      }
    );

    return NextResponse.json({ success: true, followUp }, { status: 201 });
  } catch (err) {
    console.error('[follow-up/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Fire-and-forget WhatsApp notification
function sendFollowUpNotificationAsync(
  phone: string,
  preferredLang: string,
  data: { doctorName: string; followUpDate: string; reasonAr: string }
) {
  import('@/lib/followup/notifications').then(({ sendFollowUpCreatedNotification }) => {
    sendFollowUpCreatedNotification(phone, preferredLang, data).catch((err) => {
      console.error('[follow-up] WhatsApp notification failed:', err);
    });
  });
}

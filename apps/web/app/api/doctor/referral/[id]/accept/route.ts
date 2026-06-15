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

// ─── PUT /api/doctor/referral/[id]/accept ────────────────────────────────────
// Referred doctor accepts a referral.

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceClient();

    // Fetch the referral
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, patient_id, referring_doctor_id, referred_doctor_id, referred_specialty_id, status')
      .eq('id', id)
      .single();

    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    // Verify this doctor is the referred doctor
    if (referral.referred_doctor_id !== doctorAccount.doctor_id) {
      return NextResponse.json({ error: 'You are not the referred doctor' }, { status: 403 });
    }

    if (referral.status !== 'sent') {
      return NextResponse.json(
        { error: `Cannot accept referral with status "${referral.status}"` },
        { status: 409 }
      );
    }

    // Accept the referral
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('[referral/accept/PUT] Update error:', updateError.message);
      return NextResponse.json({ error: 'Failed to accept referral' }, { status: 500 });
    }

    // Notify patient asynchronously
    notifyReferralAccepted(referral.patient_id, doctorAccount, referral.referred_specialty_id);

    return NextResponse.json({ success: true, message: 'Referral accepted', status: 'accepted' });
  } catch (err) {
    console.error('[referral/accept/PUT] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function notifyReferralAccepted(
  patientId: string,
  doctor: DoctorAccount,
  specialtyId: string
) {
  const supabase = getServiceClient();

  Promise.all([
    supabase.from('patients').select('phone_number, patient_profiles(preferred_language)').eq('id', patientId).single(),
    supabase.from('specialties').select('name_ar, name_en').eq('id', specialtyId).single(),
  ])
    .then(async ([patientRes, specialtyRes]) => {
      if (!patientRes.data || !specialtyRes.data) return;

      const patientLang =
        (patientRes.data.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
          ?.preferred_language ?? 'ar';

      const { sendReferralAcceptedToPatient } = await import('@/lib/referral/notifications');
      await sendReferralAcceptedToPatient(
        patientRes.data.phone_number,
        patientLang,
        {
          acceptingDoctorName: doctor.name_ar,
          specialtyAr: specialtyRes.data.name_ar,
          specialtyEn: specialtyRes.data.name_en ?? undefined,
        }
      ).catch((err) => console.error('[referral] Accept notification failed:', err));
    })
    .catch((err) => console.error('[referral] Notification lookup failed:', err));
}

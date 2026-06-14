import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
}

interface DeclineBody {
  reason_ar?: string;
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
    .eq('user_id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── PUT /api/doctor/referral/[id]/decline ───────────────────────────────────
// Referred doctor declines a referral.
// Auto-downgrades to tier_1 (clears referred_doctor_id).

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
    const body = (await request.json()) as DeclineBody;
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
        { error: `Cannot decline referral with status "${referral.status}"` },
        { status: 409 }
      );
    }

    // Decline and auto-downgrade to tier_1
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString(),
        decline_reason_ar: body.reason_ar ?? null,
        referred_doctor_id: null, // clear specific doctor
        tier: 'tier_1', // downgrade to any available specialist
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('[referral/decline/PUT] Update error:', updateError.message);
      return NextResponse.json({ error: 'Failed to decline referral' }, { status: 500 });
    }

    // Notify referring doctor asynchronously
    notifyReferralDeclined(referral.referring_doctor_id, doctorAccount, referral.patient_id, referral.referred_specialty_id, body.reason_ar);

    return NextResponse.json({
      success: true,
      message: 'Referral declined, auto-downgraded to Tier 1',
      status: 'declined',
      tier: 'tier_1',
    });
  } catch (err) {
    console.error('[referral/decline/PUT] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function notifyReferralDeclined(
  referringDoctorId: string,
  decliningDoctor: DoctorAccount,
  patientId: string,
  specialtyId: string,
  reasonAr?: string
) {
  const supabase = getServiceClient();

  Promise.all([
    supabase.from('doctors').select('phone_number, name_ar').eq('id', referringDoctorId).single(),
    supabase.from('patients').select('full_name_ar').eq('id', patientId).single(),
    supabase.from('specialties').select('name_ar').eq('id', specialtyId).single(),
  ])
    .then(async ([referrerRes, patientRes, specialtyRes]) => {
      if (!referrerRes.data || !patientRes.data || !specialtyRes.data) return;

      const { sendReferralDeclinedToReferrer } = await import('@/lib/referral/notifications');
      await sendReferralDeclinedToReferrer(referrerRes.data.phone_number, 'ar', {
        decliningDoctorName: decliningDoctor.name_ar,
        patientName: patientRes.data.full_name_ar,
        specialtyAr: specialtyRes.data.name_ar,
        reasonAr,
      }).catch((err) => console.error('[referral] Decline notification failed:', err));
    })
    .catch((err) => console.error('[referral] Notification lookup failed:', err));
}

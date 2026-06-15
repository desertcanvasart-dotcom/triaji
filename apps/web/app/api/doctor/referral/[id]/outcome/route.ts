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

interface OutcomeBody {
  outcome_summary_ar: string;
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

// ─── PUT /api/doctor/referral/[id]/outcome ───────────────────────────────────
// Referred doctor reports the outcome of a referral.

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
    const body = (await request.json()) as OutcomeBody;

    if (!body.outcome_summary_ar) {
      return NextResponse.json({ error: 'outcome_summary_ar is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Fetch the referral
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, patient_id, referring_doctor_id, referred_doctor_id, status')
      .eq('id', id)
      .single();

    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    // Verify this doctor is the referred doctor
    if (referral.referred_doctor_id !== doctorAccount.doctor_id) {
      return NextResponse.json({ error: 'You are not the referred doctor' }, { status: 403 });
    }

    if (referral.status !== 'accepted') {
      return NextResponse.json(
        { error: `Cannot report outcome for referral with status "${referral.status}". Referral must be accepted first.` },
        { status: 409 }
      );
    }

    // Update referral with outcome
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'outcome_reported',
        outcome_reported_at: new Date().toISOString(),
        outcome_summary_ar: body.outcome_summary_ar,
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('[referral/outcome/PUT] Update error:', updateError.message);
      return NextResponse.json({ error: 'Failed to report outcome' }, { status: 500 });
    }

    // Notify referring doctor asynchronously
    notifyReferralOutcome(referral.referring_doctor_id, doctorAccount, referral.patient_id, body.outcome_summary_ar);

    return NextResponse.json({
      success: true,
      message: 'Outcome reported',
      status: 'outcome_reported',
    });
  } catch (err) {
    console.error('[referral/outcome/PUT] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function notifyReferralOutcome(
  referringDoctorId: string,
  specialist: DoctorAccount,
  patientId: string,
  outcomeSummaryAr: string
) {
  const supabase = getServiceClient();

  // `doctors` has no phone column; the referring doctor's phone (when present)
  // lives on doctor_accounts (joined by doctor_id).
  Promise.all([
    supabase.from('doctor_accounts').select('phone').eq('doctor_id', referringDoctorId).maybeSingle(),
    supabase.from('patients').select('name_ar').eq('id', patientId).single(),
  ])
    .then(async ([referrerRes, patientRes]) => {
      if (!patientRes.data) return;
      const referrerPhone = referrerRes.data?.phone ?? null;
      if (!referrerPhone) return; // no phone on file — skip notification

      const { sendReferralOutcomeToReferrer } = await import('@/lib/referral/notifications');
      await sendReferralOutcomeToReferrer(referrerPhone, 'ar', {
        specialistName: specialist.name_ar,
        patientName: patientRes.data.name_ar,
        outcomeSummaryAr,
      }).catch((err) => console.error('[referral] Outcome notification failed:', err));
    })
    .catch((err) => console.error('[referral] Notification lookup failed:', err));
}

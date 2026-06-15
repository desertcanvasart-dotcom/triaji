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

interface ReferralBody {
  patient_id: string;
  referred_specialty_id: string;
  referred_doctor_id?: string;
  reason_ar: string;
  reason_en?: string;
  clinical_summary_ar?: string;
  clinical_summary_en?: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  booking_id?: string;
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

// ─── POST /api/doctor/referral ───────────────────────────────────────────────
// Doctor creates a referral for a patient.

export async function POST(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const body = (await request.json()) as ReferralBody;

    // Validate required fields
    if (!body.patient_id || !body.referred_specialty_id || !body.reason_ar || !body.urgency) {
      return NextResponse.json(
        { error: 'patient_id, referred_specialty_id, reason_ar, and urgency are required' },
        { status: 400 }
      );
    }

    if (!['routine', 'urgent', 'emergency'].includes(body.urgency)) {
      return NextResponse.json(
        { error: 'urgency must be "routine", "urgent", or "emergency"' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Check patient exists
    const { data: patient } = await supabase
      .from('patients')
      .select('id, phone_number, name_ar, patient_profiles(preferred_language)')
      .eq('id', body.patient_id)
      .single();

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Auto-detect tier
    const tier = body.referred_doctor_id ? 'tier_2' : 'tier_1';

    // If tier_2, verify referred doctor exists.
    // `doctors` has no phone column; phone (when present) lives on doctor_accounts.
    let referredDoctor: { id: string; name_ar: string; phone: string | null } | null = null;
    if (body.referred_doctor_id) {
      const { data: doc } = await supabase
        .from('doctors')
        .select('id, name_ar')
        .eq('id', body.referred_doctor_id)
        .single();

      if (!doc) {
        return NextResponse.json({ error: 'Referred doctor not found' }, { status: 404 });
      }

      const { data: docAccount } = await supabase
        .from('doctor_accounts')
        .select('phone')
        .eq('doctor_id', doc.id)
        .maybeSingle();

      referredDoctor = { ...doc, phone: docAccount?.phone ?? null };
    }

    // Get specialty info for notifications
    const { data: specialty } = await supabase
      .from('specialties')
      .select('id, name_ar, name_en')
      .eq('id', body.referred_specialty_id)
      .single();

    if (!specialty) {
      return NextResponse.json({ error: 'Specialty not found' }, { status: 404 });
    }

    // Create referral
    const { data: referral, error: insertError } = await supabase
      .from('referrals')
      .insert({
        patient_id: body.patient_id,
        referring_doctor_id: doctorAccount.doctor_id,
        referring_doctor_account_id: doctorAccount.id,
        referred_specialty_id: body.referred_specialty_id,
        referred_doctor_id: body.referred_doctor_id ?? null,
        reason_ar: body.reason_ar,
        reason_en: body.reason_en ?? null,
        clinical_summary_ar: body.clinical_summary_ar ?? null,
        clinical_summary_en: body.clinical_summary_en ?? null,
        urgency: body.urgency,
        tier,
        booking_id: body.booking_id ?? null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select('id, status, tier, urgency, sent_at')
      .single();

    if (insertError || !referral) {
      console.error('[doctor/referral/POST] Insert error:', insertError?.message);
      return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 });
    }

    // Send notifications asynchronously
    notifyReferralCreated(patient, doctorAccount, referredDoctor, specialty, body);

    return NextResponse.json({ success: true, referral }, { status: 201 });
  } catch (err) {
    console.error('[doctor/referral/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function notifyReferralCreated(
  patient: {
    phone_number: string;
    name_ar: string;
    patient_profiles: { preferred_language: string | null }[] | null;
  },
  doctor: DoctorAccount,
  referredDoctor: { name_ar: string; phone: string | null } | null,
  specialty: { name_ar: string; name_en: string | null },
  body: ReferralBody
) {
  const preferredLanguage = patient.patient_profiles?.[0]?.preferred_language ?? 'ar';
  import('@/lib/referral/notifications').then(({ sendReferralSentToPatient, sendReferralToDoctor }) => {
    // Notify patient
    sendReferralSentToPatient(patient.phone_number, preferredLanguage, {
      referringDoctorName: doctor.name_ar,
      specialtyAr: specialty.name_ar,
      specialtyEn: specialty.name_en ?? undefined,
      urgency: body.urgency,
      reasonAr: body.reason_ar,
    }).catch((err) => console.error('[referral] Patient notification failed:', err));

    // Notify referred doctor (tier 2 only). Skip if no phone on file.
    if (referredDoctor && referredDoctor.phone) {
      sendReferralToDoctor(referredDoctor.phone, 'ar', {
        referringDoctorName: doctor.name_ar,
        patientName: patient.name_ar,
        specialtyAr: specialty.name_ar,
        reasonAr: body.reason_ar,
        urgency: body.urgency,
      }).catch((err) => console.error('[referral] Doctor notification failed:', err));
    }
  }).catch((err) => console.error('[referral] Notification import failed:', err));
}

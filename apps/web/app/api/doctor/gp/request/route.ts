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

interface RequestBody {
  patient_id: string;
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

// ─── POST /api/doctor/gp/request ─────────────────────────────────────────────
// Doctor requests to be a patient's GP.

export async function POST(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;

    if (!body.patient_id) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Verify patient exists
    const { data: patient } = await supabase
      .from('patients')
      .select('id, phone_number, preferred_language, full_name_ar')
      .eq('id', body.patient_id)
      .single();

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Enforce: only one active or pending relationship per patient
    const { data: existing } = await supabase
      .from('gp_relationships')
      .select('id, status')
      .eq('patient_id', body.patient_id)
      .in('status', ['active', 'pending'])
      .maybeSingle();

    if (existing) {
      const msg =
        existing.status === 'active'
          ? 'Patient already has an active GP'
          : 'Patient already has a pending GP request';
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    // Create GP relationship request
    const { data: gpRelationship, error: insertError } = await supabase
      .from('gp_relationships')
      .insert({
        patient_id: body.patient_id,
        doctor_id: doctorAccount.doctor_id,
        initiated_by: 'doctor',
        status: 'pending',
      })
      .select('id, status, initiated_by, created_at')
      .single();

    if (insertError || !gpRelationship) {
      console.error('[doctor/gp/request/POST] Insert error:', insertError?.message);
      return NextResponse.json({ error: 'Failed to create GP request' }, { status: 500 });
    }

    // Send notification to patient asynchronously
    notifyPatientOfGPRequest(patient, doctorAccount, gpRelationship.id);

    return NextResponse.json({ success: true, gpRelationship }, { status: 201 });
  } catch (err) {
    console.error('[doctor/gp/request/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function notifyPatientOfGPRequest(
  patient: { phone_number: string; preferred_language: string | null },
  doctor: DoctorAccount,
  requestId: string
) {
  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://triajji.com';
  const confirmUrl = `${baseUrl}/api/gp/confirm/${requestId}`;

  import('@/lib/gp/notifications')
    .then(({ sendGPRequestNotification }) => {
      sendGPRequestNotification(patient.phone_number, patient.preferred_language ?? 'ar', {
        requesterName: doctor.name_ar,
        initiatedBy: 'doctor',
        confirmUrl,
      }).catch((err) => console.error('[gp] Patient notification failed:', err));
    })
    .catch((err) => console.error('[gp] Notification import failed:', err));
}

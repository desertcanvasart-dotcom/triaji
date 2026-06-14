import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── POST /api/patient/gp/request ────────────────────────────────────────────
// Patient requests a doctor to be their GP.

interface RequestBody {
  doctor_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const patient = await getAuthenticatedPatient();
    if (!patient) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;

    if (!body.doctor_id) {
      return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Enforce: only one active or pending relationship per patient
    const { data: existing } = await supabase
      .from('gp_relationships')
      .select('id, status')
      .eq('patient_id', patient.patientId)
      .in('status', ['active', 'pending'])
      .maybeSingle();

    if (existing) {
      const msg =
        existing.status === 'active'
          ? 'You already have an active GP. End the current relationship first.'
          : 'You already have a pending GP request.';
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    // Verify doctor exists
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id, name_ar, phone_number')
      .eq('id', body.doctor_id)
      .single();

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    // Create GP relationship request
    const { data: gpRelationship, error: insertError } = await supabase
      .from('gp_relationships')
      .insert({
        patient_id: patient.patientId,
        doctor_id: body.doctor_id,
        initiated_by: 'patient',
        status: 'pending',
      })
      .select('id, status, initiated_by, created_at')
      .single();

    if (insertError || !gpRelationship) {
      console.error('[patient/gp/request/POST] Insert error:', insertError?.message);
      return NextResponse.json({ error: 'Failed to create GP request' }, { status: 500 });
    }

    // Send notification to doctor asynchronously
    notifyDoctorOfGPRequest(patient.patientId, doctor, gpRelationship.id);

    return NextResponse.json({ success: true, gpRelationship }, { status: 201 });
  } catch (err) {
    console.error('[patient/gp/request/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function notifyDoctorOfGPRequest(
  patientId: string,
  doctor: { phone_number: string; name_ar: string },
  requestId: string
) {
  const supabase = getServiceClient();

  try {
    const { data: patientData } = await supabase
      .from('patients')
      .select('full_name_ar')
      .eq('id', patientId)
      .single();

    if (!patientData) return;

    const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://triajji.com';
    const confirmUrl = `${baseUrl}/api/gp/confirm/${requestId}`;

    const { sendGPRequestNotification } = await import('@/lib/gp/notifications');
    await sendGPRequestNotification(doctor.phone_number, 'ar', {
      requesterName: patientData.full_name_ar,
      initiatedBy: 'patient',
      confirmUrl,
    });
  } catch (err) {
    console.error('[gp] Doctor notification failed:', err);
  }
}

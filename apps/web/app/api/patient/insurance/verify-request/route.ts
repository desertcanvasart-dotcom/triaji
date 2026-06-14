import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── POST /api/patient/insurance/verify-request ─────────────────────────────
// Request verification of an insurance policy
export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.policy_id) {
    return NextResponse.json(
      { error: 'policy_id is required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Verify the policy belongs to this patient
  const { data: policy, error: fetchError } = await supabase
    .from('patient_insurance_policies')
    .select('id, status, insurer_code, policy_number')
    .eq('id', body.policy_id)
    .eq('patient_id', patient.patientId)
    .eq('is_active', true)
    .single();

  if (fetchError || !policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  // Only unverified policies can be submitted for verification
  if (policy.status !== 'unverified') {
    return NextResponse.json(
      { error: `Cannot request verification for policy with status '${policy.status}'. Must be 'unverified'.` },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from('patient_insurance_policies')
    .update({
      status: 'pending_verification',
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.policy_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    policy: updated,
    message: 'Verification request submitted. You will be notified once reviewed.',
  });
}

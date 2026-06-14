import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── POST /api/patient/consent/grant ────────────────────────────────────────
// Grant a doctor temporary access to the patient's medical record.
// Body: { doctor_id, scope, conditions_filter?, expires_in_days? }
export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: {
    doctor_id?: string;
    scope?: string;
    conditions_filter?: string[];
    expires_in_days?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { doctor_id, scope, conditions_filter, expires_in_days } = body;

  if (!doctor_id || !scope) {
    return NextResponse.json(
      { error: 'doctor_id and scope are required' },
      { status: 400 }
    );
  }

  // Validate scope
  const validScopes = ['full', 'vitals_only', 'lab_results', 'medications', 'conditions'];
  if (!validScopes.includes(scope)) {
    return NextResponse.json(
      { error: `Invalid scope. Must be one of: ${validScopes.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Verify doctor exists
  const { data: doctor } = await supabase
    .from('doctor_accounts')
    .select('id')
    .eq('id', doctor_id)
    .eq('verification_status', 'verified')
    .single();

  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found or not verified' }, { status: 404 });
  }

  // Calculate expiry (default 30 days)
  const expiryDays = expires_in_days && expires_in_days > 0 && expires_in_days <= 365
    ? expires_in_days
    : 30;
  const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();

  // Deactivate any existing grant for same doctor+patient
  await supabase
    .from('access_grants')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('patient_id', patient.patientId)
    .eq('doctor_account_id', doctor_id)
    .eq('is_active', true);

  // Insert new grant
  const { data: grant, error: insertError } = await supabase
    .from('access_grants')
    .insert({
      patient_id: patient.patientId,
      doctor_account_id: doctor_id,
      scope,
      conditions_filter: conditions_filter ?? null,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_active: true,
    })
    .select('id, scope, granted_at, expires_at')
    .single();

  if (insertError) {
    console.error('[consent/grant] Insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to create access grant' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    grant,
  });
}

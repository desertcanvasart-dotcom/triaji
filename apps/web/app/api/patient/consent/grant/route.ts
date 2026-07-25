import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { UI_SCOPES, isUiScope, toDbScope, toUiScope } from '@/lib/consent/scopes';

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
  if (!isUiScope(scope)) {
    return NextResponse.json(
      { error: `Invalid scope. Must be one of: ${UI_SCOPES.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Verify doctor exists. record_access_grants records both the account and the
  // bookable doctors row, and both are NOT NULL, so pull the link here.
  const { data: doctor } = await supabase
    .from('doctor_accounts')
    .select('id, doctor_id')
    .eq('id', doctor_id)
    .eq('verification_status', 'verified')
    .single();

  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found or not verified' }, { status: 404 });
  }

  // Verification normally creates the doctors row, but it can fail (unmatched
  // specialty, missing governorate) and leave the account without one.
  if (!doctor.doctor_id) {
    return NextResponse.json(
      { error: 'This doctor has no bookable profile yet — access cannot be granted.' },
      { status: 409 }
    );
  }

  // Calculate expiry (default 30 days)
  const expiryDays = expires_in_days && expires_in_days > 0 && expires_in_days <= 365
    ? expires_in_days
    : 30;
  const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();

  // Deactivate any existing grant for same doctor+patient
  await supabase
    .from('record_access_grants')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('patient_id', patient.patientId)
    .eq('granted_to_account', doctor_id)
    .eq('is_active', true);

  // Insert new grant
  const { data: grant, error: insertError } = await supabase
    .from('record_access_grants')
    .insert({
      patient_id: patient.patientId,
      granted_to_account: doctor_id,
      granted_to_doctor: doctor.doctor_id,
      scope: toDbScope(scope),
      conditions_filter: conditions_filter ?? null,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_active: true,
      source: 'patient',
    })
    .select('id, scope, granted_at, expires_at')
    .single();

  if (insertError) {
    console.error('[consent/grant] Insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to create access grant' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    // Answer in the vocabulary the caller used.
    grant: { ...grant, scope: toUiScope(grant.scope as string) },
  });
}

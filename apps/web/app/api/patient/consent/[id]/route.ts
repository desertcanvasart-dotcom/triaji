import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── DELETE /api/patient/consent/[id] ───────────────────────────────────────
// Revoke an access grant (set is_active=false, revoked_at).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: grantId } = await params;

  if (!grantId) {
    return NextResponse.json({ error: 'Grant ID is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Verify the grant belongs to this patient and is active
  const { data: grant } = await supabase
    .from('record_access_grants')
    .select('id, patient_id, is_active')
    .eq('id', grantId)
    .single();

  if (!grant) {
    return NextResponse.json({ error: 'Access grant not found' }, { status: 404 });
  }

  if (grant.patient_id !== patient.patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!grant.is_active) {
    return NextResponse.json({ error: 'Grant already revoked' }, { status: 409 });
  }

  // Revoke the grant
  const { error: updateError } = await supabase
    .from('record_access_grants')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', grantId);

  if (updateError) {
    console.error('[consent/revoke] Update error:', updateError.message);
    return NextResponse.json({ error: 'Failed to revoke access grant' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

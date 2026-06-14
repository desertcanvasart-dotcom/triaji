import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import type { VaccineStatus } from '@triaji/shared/types/paediatric';

// ─── Helper: verify guardian access to child ────────────────────────────────
async function verifyGuardianAccess(guardianPatientId: string, childPatientId: string) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('guardian_relationships')
    .select('id')
    .eq('guardian_patient_id', guardianPatientId)
    .eq('child_patient_id', childPatientId)
    .eq('can_view_records', true)
    .single();
  return !!data;
}

// ─── PUT /api/child/[id]/vaccines/[vaccId] ──────────────────────────────────
// Update vaccine status (mark as given, skip, or defer)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vaccId: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: childId, vaccId } = await params;

  const hasAccess = await verifyGuardianAccess(patient.patientId, childId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const {
    status,
    given_date,
    given_at_facility,
    batch_number,
    skip_reason_ar,
    defer_reason_ar,
  } = body as {
    status: VaccineStatus;
    given_date?: string;
    given_at_facility?: string;
    batch_number?: string;
    skip_reason_ar?: string;
    defer_reason_ar?: string;
  };

  if (!status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  const validStatuses: VaccineStatus[] = ['given', 'skipped', 'deferred', 'due'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Verify the vaccine entry belongs to this child
  const { data: existing } = await supabase
    .from('vaccination_schedule')
    .select('id, patient_id')
    .eq('id', vaccId)
    .single();

  if (!existing || existing.patient_id !== childId) {
    return NextResponse.json({ error: 'Vaccine record not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'given') {
    updateData.given_date = given_date ?? new Date().toISOString().split('T')[0];
    updateData.given_at_facility = given_at_facility ?? null;
    updateData.batch_number = batch_number ?? null;
  } else if (status === 'skipped') {
    updateData.skip_reason_ar = skip_reason_ar ?? null;
  } else if (status === 'deferred') {
    updateData.defer_reason_ar = defer_reason_ar ?? null;
  }

  const { error } = await supabase
    .from('vaccination_schedule')
    .update(updateData)
    .eq('id', vaccId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

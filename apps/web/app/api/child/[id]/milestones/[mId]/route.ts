import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

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

// ─── PUT /api/child/[id]/milestones/[mId] ───────────────────────────────────
// Update a milestone (mark as achieved or update notes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mId: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: childId, mId: milestoneId } = await params;

  const hasAccess = await verifyGuardianAccess(patient.patientId, childId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { achieved, achieved_at_months, notes_ar } = body as {
    achieved: boolean;
    achieved_at_months?: number;
    notes_ar?: string;
  };

  if (typeof achieved !== 'boolean') {
    return NextResponse.json({ error: 'achieved (boolean) is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Verify the milestone exists in catalog
  const { data: milestoneExists } = await supabase
    .from('milestone_catalog')
    .select('id')
    .eq('id', milestoneId)
    .single();

  if (!milestoneExists) {
    return NextResponse.json({ error: 'Milestone not found in catalog' }, { status: 404 });
  }

  // Upsert patient_milestones
  const { data: existing } = await supabase
    .from('patient_milestones')
    .select('id')
    .eq('patient_id', childId)
    .eq('milestone_id', milestoneId)
    .single();

  const milestoneData = {
    patient_id: childId,
    milestone_id: milestoneId,
    achieved,
    achieved_at_months: achieved_at_months ?? null,
    notes_ar: notes_ar ?? null,
    assessed_by: 'parent',
    assessed_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from('patient_milestones')
      .update(milestoneData)
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('patient_milestones')
      .insert(milestoneData);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

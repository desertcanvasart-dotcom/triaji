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

// ─── GET /api/child/[id]/vaccines ───────────────────────────────────────────
// Returns the full vaccination schedule with joined vaccine_catalog data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: childId } = await params;

  const hasAccess = await verifyGuardianAccess(patient.patientId, childId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Get vaccination schedule with joined catalog
  const { data: schedule, error } = await supabase
    .from('vaccination_schedule')
    .select(`
      *,
      vaccine:vaccine_catalog!vaccination_schedule_vaccine_code_fkey (
        code,
        name_ar,
        name_en,
        disease_ar,
        disease_en,
        doses_required,
        is_mandatory,
        egypt_moh_code,
        notes_ar,
        sort_order
      )
    `)
    .eq('patient_id', childId)
    .order('scheduled_age_months', { ascending: true })
    .order('dose_number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Split into completed vs upcoming/overdue
  const completed = (schedule ?? []).filter(
    (v: Record<string, unknown>) => v.status === 'given' || v.status === 'skipped'
  );
  const upcoming = (schedule ?? []).filter(
    (v: Record<string, unknown>) => v.status === 'due' || v.status === 'overdue' || v.status === 'deferred'
  );

  return NextResponse.json({
    schedule: schedule ?? [],
    completed,
    upcoming,
    totalDoses: schedule?.length ?? 0,
    completedDoses: completed.length,
  });
}

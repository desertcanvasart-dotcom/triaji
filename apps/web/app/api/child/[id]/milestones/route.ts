import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import type { MilestoneCatalog, PatientMilestone } from '@triaji/shared/types/paediatric';

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

// ─── GET /api/child/[id]/milestones ─────────────────────────────────────────
// Returns milestones for child's age (all up to current age + next 6 months)
// joined with patient_milestones for achievement status
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

  // Get child's date of birth
  const { data: profile } = await supabase
    .from('patient_profiles')
    .select('date_of_birth')
    .eq('patient_id', childId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Child profile not found' }, { status: 404 });
  }

  const dob = new Date(profile.date_of_birth);
  const now = new Date();
  const ageMonths = Math.floor((now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const maxMonth = ageMonths + 6;

  // Get all milestones up to child's age + 6 months
  const { data: catalog, error: catError } = await supabase
    .from('milestone_catalog')
    .select('*')
    .lte('age_months', maxMonth)
    .order('category', { ascending: true })
    .order('age_months', { ascending: true })
    .order('sort_order', { ascending: true });

  if (catError) {
    return NextResponse.json({ error: catError.message }, { status: 500 });
  }

  // Get patient's milestone achievements
  const { data: patientMilestones, error: pmError } = await supabase
    .from('patient_milestones')
    .select('*')
    .eq('patient_id', childId);

  if (pmError) {
    return NextResponse.json({ error: pmError.message }, { status: 500 });
  }

  // Create a map of milestone_id -> patient_milestone
  const achievementMap = new Map<string, PatientMilestone>();
  (patientMilestones ?? []).forEach((pm: PatientMilestone) => {
    achievementMap.set(pm.milestone_id, pm);
  });

  // Join milestones with achievements and compute status
  const milestones = (catalog ?? []).map((m: MilestoneCatalog) => {
    const achievement = achievementMap.get(m.id);
    const isPastTarget = ageMonths > m.age_months;
    const isAchieved = achievement?.achieved === true;
    const isRedFlag = m.is_red_flag && isPastTarget && !isAchieved;

    return {
      ...m,
      achievement: achievement ?? null,
      status: isAchieved
        ? 'achieved' as const
        : isRedFlag
          ? 'red_flag' as const
          : 'upcoming' as const,
    };
  });

  // Group by category
  const byCategory: Record<string, typeof milestones> = {};
  for (const m of milestones) {
    if (!byCategory[m.category]) {
      byCategory[m.category] = [];
    }
    byCategory[m.category]!.push(m);
  }

  // Check for any red flags
  const redFlags = milestones.filter((m) => m.status === 'red_flag');

  return NextResponse.json({
    milestones,
    byCategory,
    ageMonths,
    redFlagCount: redFlags.length,
    totalMilestones: milestones.length,
    achievedCount: milestones.filter((m) => m.status === 'achieved').length,
  });
}

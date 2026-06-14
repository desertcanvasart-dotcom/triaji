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

// ─── GET /api/child/[id]/growth ─────────────────────────────────────────────
// Returns growth measurements + WHO reference data for the child
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: childId } = await params;

  // Verify guardian access
  const hasAccess = await verifyGuardianAccess(patient.patientId, childId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Get child profile for sex
  const { data: profile } = await supabase
    .from('patient_profiles')
    .select('biological_sex, date_of_birth')
    .eq('patient_id', childId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Child profile not found' }, { status: 404 });
  }

  // Get measurements
  const { data: measurements, error: measError } = await supabase
    .from('growth_measurements')
    .select('*')
    .eq('patient_id', childId)
    .order('age_months', { ascending: true });

  if (measError) {
    return NextResponse.json({ error: measError.message }, { status: 500 });
  }

  // Get WHO reference curves for this sex
  const { data: reference } = await supabase
    .from('who_growth_reference')
    .select('*')
    .eq('sex', profile.biological_sex)
    .order('age_months', { ascending: true });

  return NextResponse.json({
    measurements: measurements ?? [],
    reference: reference ?? [],
    sex: profile.biological_sex,
    dateOfBirth: profile.date_of_birth,
  });
}

// ─── POST /api/child/[id]/growth ────────────────────────────────────────────
// Add a new growth measurement
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: childId } = await params;

  // Verify guardian access
  const hasAccess = await verifyGuardianAccess(patient.patientId, childId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { weight_kg, height_cm, head_circ_cm, measured_at } = body as {
    weight_kg?: number;
    height_cm?: number;
    head_circ_cm?: number;
    measured_at?: string;
  };

  if (!weight_kg && !height_cm) {
    return NextResponse.json(
      { error: 'At least weight_kg or height_cm is required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Get child's date of birth
  const { data: profile } = await supabase
    .from('patient_profiles')
    .select('date_of_birth, biological_sex')
    .eq('patient_id', childId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Child profile not found' }, { status: 404 });
  }

  const measureDate = measured_at ? new Date(measured_at) : new Date();
  const dob = new Date(profile.date_of_birth);
  const ageMs = measureDate.getTime() - dob.getTime();
  const ageMonths = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30.44)));

  // Calculate BMI if both weight and height available
  const bmi =
    weight_kg && height_cm
      ? Number((weight_kg / ((height_cm / 100) ** 2)).toFixed(1))
      : null;

  // Try to calculate percentiles via RPC (returns null if RPC not available)
  let weightPercentile: number | null = null;
  let heightPercentile: number | null = null;
  let bmiPercentile: number | null = null;
  let headCircPercentile: number | null = null;

  try {
    if (weight_kg) {
      const { data: wp } = await supabase.rpc('calculate_percentile', {
        p_sex: profile.biological_sex,
        p_age_months: ageMonths,
        p_measure: 'weight',
        p_value: weight_kg,
      });
      weightPercentile = wp ?? null;
    }

    if (height_cm) {
      const { data: hp } = await supabase.rpc('calculate_percentile', {
        p_sex: profile.biological_sex,
        p_age_months: ageMonths,
        p_measure: 'height',
        p_value: height_cm,
      });
      heightPercentile = hp ?? null;
    }

    if (bmi) {
      const { data: bp } = await supabase.rpc('calculate_percentile', {
        p_sex: profile.biological_sex,
        p_age_months: ageMonths,
        p_measure: 'bmi',
        p_value: bmi,
      });
      bmiPercentile = bp ?? null;
    }

    if (head_circ_cm) {
      const { data: hcp } = await supabase.rpc('calculate_percentile', {
        p_sex: profile.biological_sex,
        p_age_months: ageMonths,
        p_measure: 'head_circ',
        p_value: head_circ_cm,
      });
      headCircPercentile = hcp ?? null;
    }
  } catch {
    // Percentile calculation not available — continue without
  }

  const { data: measurement, error } = await supabase
    .from('growth_measurements')
    .insert({
      patient_id: childId,
      measured_at: measureDate.toISOString(),
      age_months: ageMonths,
      weight_kg: weight_kg ?? null,
      height_cm: height_cm ?? null,
      head_circ_cm: head_circ_cm ?? null,
      bmi,
      weight_percentile: weightPercentile,
      height_percentile: heightPercentile,
      bmi_percentile: bmiPercentile,
      head_circ_percentile: headCircPercentile,
      source: 'parent',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, measurementId: measurement?.id });
}

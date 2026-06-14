import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { loadFullPatientProfile, loadOptionCatalogs } from '@/lib/triage/profile-loader';
import { calculateBRS } from '@triaji/rules-engine';
import type { OnboardingPayload } from '@triaji/shared/types';

// ─── GET /api/patient/onboarding ─────────────────────────────────────────────
// Returns current profile + option catalogs (for resuming onboarding)
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const [fullProfile, catalogs] = await Promise.all([
    loadFullPatientProfile(patient.patientId),
    loadOptionCatalogs(),
  ]);

  return NextResponse.json({
    profile: fullProfile?.base ?? null,
    structured: fullProfile?.structured ?? null,
    catalogs,
  });
}

// ─── POST /api/patient/onboarding ────────────────────────────────────────────
// Save all onboarding data
export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as OnboardingPayload;

  // Validate required fields (Step 1)
  if (!body.age || !body.biological_sex || !body.governorate_id) {
    return NextResponse.json(
      { error: 'age, biological_sex, and governorate_id are required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 1. Get existing profile id or create profile
  let { data: existingProfile } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('patient_id', patient.patientId)
    .single();

  // Calculate BMI
  const bmi =
    body.height_cm && body.weight_kg
      ? Number((body.weight_kg / ((body.height_cm / 100) ** 2)).toFixed(1))
      : null;

  // Calculate BRS with family history
  const familyHistoryCodes = new Set(body.family_history?.map((fh) => fh.condition_code) ?? []);
  const brsResult = calculateBRS({
    symptoms: [],
    rawText: '',
    profile: {
      age: body.age,
      biologicalSex: body.biological_sex,
      smokingStatus: (body.smoking_status as 'never' | 'current' | 'former') ?? 'never',
      bloodPressure: (body.blood_pressure as 'none' | 'controlled' | 'uncontrolled' | 'unknown') ?? 'none',
      diabetesType: (body.diabetes_type as 'none' | 'type1' | 'type2' | 'unknown') ?? 'none',
      diabetesControl: (body.diabetes_control as 'controlled' | 'uncontrolled' | 'unknown' | 'na') ?? 'na',
      heartCondition: (body.heart_condition as 'none' | 'known' | 'unknown') ?? 'none',
      previousHeartAttack: body.previous_heart_attack ?? false,
      brs: 0,
      riskLevel: 'low',
      familyHistory: {
        heartDisease: familyHistoryCodes.has('heart_disease'),
        heartAttack: familyHistoryCodes.has('heart_attack'),
        stroke: familyHistoryCodes.has('stroke'),
        hypertension: familyHistoryCodes.has('hypertension'),
        diabetes: familyHistoryCodes.has('diabetes'),
        cancer: familyHistoryCodes.has('cancer'),
      },
    },
  });

  // 2. Upsert patient_profiles
  const profileData = {
    patient_id: patient.patientId,
    age: body.age,
    biological_sex: body.biological_sex,
    governorate_id: body.governorate_id,
    height_cm: body.height_cm,
    weight_kg: body.weight_kg,
    bmi,
    work_type: body.work_type ?? 'other',
    work_schedule: body.work_schedule ?? 'day',
    activity_level: body.activity_level ?? 'low',
    smoking_status: body.smoking_status ?? 'never',
    cigarettes_per_day: body.cigarettes_per_day,
    smoking_years: body.smoking_years,
    blood_pressure: body.blood_pressure ?? 'none',
    bp_on_medication: body.bp_on_medication ?? false,
    diabetes_type: body.diabetes_type ?? 'none',
    diabetes_control: body.diabetes_control ?? 'na',
    diabetes_treatment: body.diabetes_treatment ?? 'na',
    heart_condition: body.heart_condition ?? 'none',
    previous_heart_attack: body.previous_heart_attack ?? false,
    heart_surgery: body.heart_surgery ?? false,
    kidney_disease: body.kidney_disease ?? 'none',
    liver_disease: body.liver_disease ?? 'none',
    background_risk_score: brsResult.score,
    risk_level: brsResult.level,
    // Reproductive health (female only)
    pregnancy_status: body.biological_sex === 'female' ? body.pregnancy_status : null,
    previous_pregnancies: body.biological_sex === 'female' ? body.previous_pregnancies : null,
    menstrual_regularity: body.biological_sex === 'female' ? body.menstrual_regularity : null,
    menopause_status: body.biological_sex === 'female' ? body.menopause_status : null,
    last_menstrual_period_approx: body.biological_sex === 'female' ? body.last_menstrual_period_approx : null,
    updated_at: new Date().toISOString(),
  };

  let profileId: string;

  if (existingProfile) {
    profileId = existingProfile.id;
    const { error } = await supabase
      .from('patient_profiles')
      .update(profileData)
      .eq('id', profileId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { data, error } = await supabase
      .from('patient_profiles')
      .insert(profileData)
      .select('id')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Failed to create profile' }, { status: 500 });
    }
    profileId = data.id;
  }

  // 3. Delete + re-insert junction table rows (simpler than diffing)
  await Promise.all([
    supabase.from('patient_allergies').delete().eq('patient_profile_id', profileId),
    supabase.from('patient_chronic_conditions').delete().eq('patient_profile_id', profileId),
    supabase.from('patient_medications').delete().eq('patient_profile_id', profileId),
    supabase.from('patient_surgeries').delete().eq('patient_profile_id', profileId),
    supabase.from('patient_family_history').delete().eq('patient_profile_id', profileId),
  ]);

  // 4. Insert new junction data
  if (body.allergies?.length > 0) {
    await supabase.from('patient_allergies').insert(
      body.allergies.map((a) => ({
        patient_profile_id: profileId,
        allergy_code: a.code,
        notes_ar: a.notes_ar ?? null,
      }))
    );
  }

  if (body.chronic_conditions?.length > 0) {
    await supabase.from('patient_chronic_conditions').insert(
      body.chronic_conditions.map((c) => ({
        patient_profile_id: profileId,
        condition_code: c.code,
        notes_ar: c.notes_ar ?? null,
        diagnosed_year: c.diagnosed_year ?? null,
      }))
    );
  }

  if (body.medications?.length > 0) {
    await supabase.from('patient_medications').insert(
      body.medications.map((m, i) => ({
        patient_profile_id: profileId,
        drug_name_ar: m.drug_name_ar,
        drug_name_en: m.drug_name_en ?? null,
        dose: m.dose ?? null,
        frequency_ar: m.frequency_ar ?? null,
        for_condition_ar: m.for_condition_ar ?? null,
        sort_order: i,
      }))
    );
  }

  if (body.surgeries?.length > 0) {
    await supabase.from('patient_surgeries').insert(
      body.surgeries.map((s) => ({
        patient_profile_id: profileId,
        surgery_code: s.code,
        year_approximate: s.year_approximate ?? null,
        notes_ar: s.notes_ar ?? null,
      }))
    );
  }

  if (body.family_history?.length > 0) {
    await supabase.from('patient_family_history').insert(
      body.family_history.map((fh) => ({
        patient_profile_id: profileId,
        condition_code: fh.condition_code,
        relation: fh.relation,
        notes_ar: fh.notes_ar ?? null,
      }))
    );
  }

  return NextResponse.json({
    success: true,
    profileId,
    brs: brsResult,
  });
}

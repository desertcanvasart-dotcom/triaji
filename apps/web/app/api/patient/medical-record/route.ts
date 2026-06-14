import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/medical-record ──────────────────────────────────────────
// Returns the full longitudinal medical record for the authenticated patient.
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const pid = patient.patientId;

  // Run all queries in parallel
  const [
    profileResult,
    vitalsResult,
    followUpsResult,
    labResultsResult,
    prescriptionsResult,
    routingResult,
  ] = await Promise.all([
    // 1. Full profile with junction tables
    supabase
      .from('patient_profiles')
      .select(`
        *,
        patient_allergies(*),
        patient_chronic_conditions(*),
        patient_medications(*),
        patient_surgeries(*),
        patient_family_history(*)
      `)
      .eq('patient_id', pid)
      .single(),

    // 2. Latest vitals — most recent per vital_type
    supabase
      .from('vitals_history')
      .select('*')
      .eq('patient_id', pid)
      .order('measured_at', { ascending: false })
      .limit(20),

    // 3. Active follow-ups
    supabase
      .from('follow_up_schedule')
      .select('id, follow_up_date, reason_ar, reason_en, status, source, created_at')
      .eq('patient_id', pid)
      .neq('status', 'cancelled')
      .order('follow_up_date', { ascending: true }),

    // 4. Latest lab results
    supabase
      .from('health_records')
      .select('id, lab_values, lab_date, lab_name, summary_ar, has_abnormal_values, created_at')
      .eq('patient_id', pid)
      .eq('record_type', 'lab_result')
      .is('deleted_at', null)
      .order('lab_date', { ascending: false })
      .limit(20),

    // 5. Prescriptions in last 90 days
    supabase
      .from('health_records')
      .select(`
        id, document_number, prescription_date, prescribing_doctor, summary_ar,
        prescription_items(drug_name_ar, drug_name_en, dose, frequency_ar, duration_ar)
      `)
      .eq('patient_id', pid)
      .eq('record_type', 'prescription')
      .is('deleted_at', null)
      .gte('prescription_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
      .order('prescription_date', { ascending: false }),

    // 6. Prescription routing (for adherence calculation)
    supabase
      .from('prescription_routing')
      .select('health_record_id, status, collected_at')
      .eq('patient_id', pid),
  ]);

  // If profile not found, return minimal response
  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({
      profile: null,
      vitals: [],
      followUps: [],
      labResults: [],
      adherence: { total: 0, dispensed: 0, rate: 0 },
      brs: null,
    });
  }

  const profile = profileResult.data;

  // Fallback: if RPC unavailable, query vitals manually
  let latestVitals = vitalsResult.data;
  if (!latestVitals) {
    const { data: rawVitals } = await supabase
      .from('vitals_history')
      .select('vital_type, value, unit, measured_at, source')
      .eq('patient_id', pid)
      .order('measured_at', { ascending: false })
      .limit(100);

    // Deduplicate: keep only most recent per vital_type
    const seen = new Set<string>();
    latestVitals = (rawVitals ?? []).filter((v: { vital_type: string }) => {
      if (seen.has(v.vital_type)) return false;
      seen.add(v.vital_type);
      return true;
    });
  }

  // Calculate adherence summary from prescriptions + routing
  const routingMap = new Map<string, string>();
  for (const r of routingResult.data ?? []) {
    routingMap.set(r.health_record_id, r.status);
  }

  const prescriptions = prescriptionsResult.data ?? [];
  const totalPrescriptions = prescriptions.length;
  let dispensedCount = 0;
  for (const rx of prescriptions) {
    const routingStatus = routingMap.get(rx.id);
    if (routingStatus === 'collected' || routingStatus === 'ready' || routingStatus === 'partial_ready') {
      dispensedCount++;
    }
  }

  const adherenceRate = totalPrescriptions > 0
    ? Math.round((dispensedCount / totalPrescriptions) * 100)
    : 100;

  return NextResponse.json({
    profile: {
      base: {
        age: profile.age,
        biological_sex: profile.biological_sex,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        bmi: profile.bmi,
        smoking_status: profile.smoking_status,
        blood_pressure: profile.blood_pressure,
        diabetes_type: profile.diabetes_type,
        diabetes_control: profile.diabetes_control,
        heart_condition: profile.heart_condition,
        kidney_disease: profile.kidney_disease,
        liver_disease: profile.liver_disease,
      },
      allergies: profile.patient_allergies ?? [],
      chronicConditions: profile.patient_chronic_conditions ?? [],
      medications: profile.patient_medications ?? [],
      surgeries: profile.patient_surgeries ?? [],
      familyHistory: profile.patient_family_history ?? [],
    },
    vitals: latestVitals ?? [],
    followUps: followUpsResult.data ?? [],
    labResults: (labResultsResult.data ?? []).map((lr: Record<string, unknown>) => ({
      id: lr.id,
      labDate: lr.lab_date,
      labName: lr.lab_name,
      values: lr.lab_values,
      summaryAr: lr.summary_ar,
      hasAbnormal: lr.has_abnormal_values,
    })),
    adherence: {
      total: totalPrescriptions,
      dispensed: dispensedCount,
      rate: adherenceRate,
    },
    brs: {
      score: profile.background_risk_score,
      level: profile.risk_level,
    },
  });
}

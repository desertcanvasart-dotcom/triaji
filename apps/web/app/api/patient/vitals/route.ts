import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// Valid vital types that patients can self-report
const SELF_REPORTABLE_VITALS = new Set([
  'weight_kg',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'blood_glucose_fasting',
  'blood_glucose_random',
  'heart_rate',
  'oxygen_saturation',
  'temperature',
  'waist_cm',
]);

// Default units per vital type
const DEFAULT_UNITS: Record<string, string> = {
  weight_kg: 'kg',
  blood_pressure_systolic: 'mmHg',
  blood_pressure_diastolic: 'mmHg',
  blood_glucose_fasting: 'mg/dL',
  blood_glucose_random: 'mg/dL',
  heart_rate: 'bpm',
  oxygen_saturation: '%',
  temperature: '°C',
  waist_cm: 'cm',
};

interface VitalsBody {
  vital_type: string;
  value: number;
  unit?: string;
  notes_ar?: string;
}

// ─── POST /api/patient/vitals ─────────────────────────────────────────────────
// Patient self-reports a vital measurement.
export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as VitalsBody;

  // Validate vital_type
  if (!body.vital_type || !SELF_REPORTABLE_VITALS.has(body.vital_type)) {
    return NextResponse.json(
      { error: `Invalid vital_type. Allowed: ${[...SELF_REPORTABLE_VITALS].join(', ')}` },
      { status: 400 }
    );
  }

  // Validate value
  if (body.value == null || typeof body.value !== 'number' || body.value <= 0) {
    return NextResponse.json({ error: 'value must be a positive number' }, { status: 400 });
  }

  const unit = body.unit ?? DEFAULT_UNITS[body.vital_type] ?? '';

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('vitals_history')
    .insert({
      patient_id: patient.patientId,
      vital_type: body.vital_type,
      value: body.value,
      unit,
      source: 'patient_self',
      notes_ar: body.notes_ar ?? null,
      measured_at: new Date().toISOString(),
    })
    .select('id, vital_type, value, unit, measured_at')
    .single();

  if (error) {
    console.error('[vitals/POST] Insert error:', error.message);
    return NextResponse.json({ error: 'Failed to save vital' }, { status: 500 });
  }

  return NextResponse.json({ success: true, vital: data }, { status: 201 });
}

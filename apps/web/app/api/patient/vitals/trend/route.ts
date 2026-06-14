import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// Reference ranges per vital type (typical adult ranges)
const REFERENCE_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  weight_kg: { min: 40, max: 120, unit: 'kg' },
  blood_pressure_systolic: { min: 90, max: 140, unit: 'mmHg' },
  blood_pressure_diastolic: { min: 60, max: 90, unit: 'mmHg' },
  blood_glucose_fasting: { min: 70, max: 100, unit: 'mg/dL' },
  blood_glucose_random: { min: 70, max: 140, unit: 'mg/dL' },
  heart_rate: { min: 60, max: 100, unit: 'bpm' },
  oxygen_saturation: { min: 95, max: 100, unit: '%' },
  temperature: { min: 36.1, max: 37.2, unit: '°C' },
  bmi: { min: 18.5, max: 25, unit: 'kg/m²' },
  waist_cm: { min: 60, max: 102, unit: 'cm' },
};

// ─── GET /api/patient/vitals/trend ────────────────────────────────────────────
// Returns time-series data for a specific vital type.
// Query params: type (vital_type), months (default 12)
export async function GET(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const vitalType = searchParams.get('type');
  const months = Math.min(parseInt(searchParams.get('months') ?? '12', 10) || 12, 60);

  if (!vitalType) {
    return NextResponse.json({ error: 'type query parameter is required' }, { status: 400 });
  }

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('vitals_history')
    .select('value, unit, measured_at, source')
    .eq('patient_id', patient.patientId)
    .eq('vital_type', vitalType)
    .gte('measured_at', startDate.toISOString())
    .order('measured_at', { ascending: true });

  if (error) {
    console.error('[vitals/trend] Query error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch vitals trend' }, { status: 500 });
  }

  const points = (data ?? []).map((row: { value: number; unit: string; measured_at: string; source: string }) => ({
    date: row.measured_at,
    value: Number(row.value),
    source: row.source,
  }));

  return NextResponse.json({
    vitalType,
    months,
    points,
    referenceRange: REFERENCE_RANGES[vitalType] ?? null,
    count: points.length,
  });
}

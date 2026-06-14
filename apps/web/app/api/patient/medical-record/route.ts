import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { buildMedicalRecord } from '@/lib/records/build-medical-record';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/medical-record ──────────────────────────────────────────
// Full longitudinal medical record for the authenticated patient, shaped as
// MedicalRecordData for the dashboard component.
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: patientRow } = await supabase
    .from('patients')
    .select('name_ar')
    .eq('id', patient.patientId)
    .single();

  const record = await buildMedicalRecord(
    supabase,
    patient.patientId,
    (patientRow?.name_ar as string) ?? 'مريض'
  );
  return NextResponse.json(record);
}

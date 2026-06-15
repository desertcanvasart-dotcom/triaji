import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { buildMedicalRecord } from '@/lib/records/build-medical-record';
import { buildChildMedicalRecord } from '@/lib/records/build-child-medical-record';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/medical-record[?child_id=…] ─────────────────────────────
// Without child_id: the authenticated patient's own record (MedicalRecordData).
// With child_id: the child's paediatric record (ChildRecordData), gated by a
// guardian_relationships check so a guardian can only read their own children.
export async function GET(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const childId = request.nextUrl.searchParams.get('child_id');

  if (childId) {
    const { data: rel } = await supabase
      .from('guardian_relationships')
      .select('id')
      .eq('guardian_patient_id', patient.patientId)
      .eq('child_patient_id', childId)
      .maybeSingle();
    if (!rel) {
      return NextResponse.json({ error: 'Not authorized for this child' }, { status: 403 });
    }
    const childRecord = await buildChildMedicalRecord(supabase, childId);
    return NextResponse.json(childRecord);
  }

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

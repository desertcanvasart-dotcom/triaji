import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import type { SchoolHealthRecord } from '@triaji/shared/types/paediatric';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/school-health?child_id=<uuid> ──────────────────────────
// Returns the school-health records for a child, scoped to the authenticated
// guardian. The guardian must have a guardian_relationships row linking them to
// the requested child, otherwise the request is rejected.
export async function GET(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const childId = request.nextUrl.searchParams.get('child_id');
  if (!childId) {
    return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Authorization: confirm the requested child belongs to this guardian.
  const { data: relationship, error: relError } = await supabase
    .from('guardian_relationships')
    .select('child_patient_id')
    .eq('guardian_patient_id', patient.patientId)
    .eq('child_patient_id', childId)
    .maybeSingle();

  if (relError) {
    return NextResponse.json({ error: relError.message }, { status: 500 });
  }

  if (!relationship) {
    return NextResponse.json({ error: 'Child not found for this guardian' }, { status: 403 });
  }

  // Fetch the child's school-health records, newest first.
  const { data: rows, error } = await supabase
    .from('school_health_records')
    .select(
      `
      id,
      patient_id,
      academic_year,
      school_name_ar,
      school_grade_ar,
      exam_date,
      examining_doctor,
      height_cm,
      weight_kg,
      vision_right,
      vision_left,
      hearing_normal,
      dental_notes_ar,
      general_notes_ar,
      fit_for_school,
      restriction_ar,
      certificate_issued,
      certificate_pdf_url,
      created_at
    `
    )
    .eq('patient_id', childId)
    .order('exam_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records: SchoolHealthRecord[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    patient_id: r.patient_id as string,
    academic_year: r.academic_year as string,
    school_name_ar: r.school_name_ar as string,
    school_grade_ar: r.school_grade_ar as string,
    exam_date: (r.exam_date as string | null) ?? null,
    examining_doctor: (r.examining_doctor as string | null) ?? null,
    height_cm: (r.height_cm as number | null) ?? null,
    weight_kg: (r.weight_kg as number | null) ?? null,
    vision_right: (r.vision_right as string | null) ?? null,
    vision_left: (r.vision_left as string | null) ?? null,
    hearing_normal: (r.hearing_normal as boolean | null) ?? null,
    dental_notes_ar: (r.dental_notes_ar as string | null) ?? null,
    general_notes_ar: (r.general_notes_ar as string | null) ?? null,
    fit_for_school: Boolean(r.fit_for_school),
    restriction_ar: (r.restriction_ar as string | null) ?? null,
    certificate_issued: Boolean(r.certificate_issued),
    certificate_pdf_url: (r.certificate_pdf_url as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  return NextResponse.json(records);
}

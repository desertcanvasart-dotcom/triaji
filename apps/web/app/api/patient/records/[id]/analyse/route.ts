/**
 * POST /api/patient/records/[id]/analyse — re-trigger AI analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { createServerClient } from '@triaji/shared/supabase';
import { analyseHealthRecord } from '@/lib/records/analyser';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServerClient();

  // Verify ownership
  const { data: record } = await supabase
    .from('health_records')
    .select('id')
    .eq('id', id)
    .eq('patient_id', patient.patientId)
    .is('deleted_at', null)
    .single();

  if (!record) {
    return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
  }

  // Trigger analysis
  try {
    await analyseHealthRecord(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

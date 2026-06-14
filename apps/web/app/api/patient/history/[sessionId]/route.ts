import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

// GET /api/patient/history/[sessionId] — single session detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: summary, error } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('session_id', sessionId)
    .eq('patient_id', patient.patientId)
    .single();

  if (error || !summary) {
    return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
  }

  return NextResponse.json({ summary });
}

// PUT /api/patient/history/[sessionId] — patient adds notes
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as { notes?: string };
  if (!body.notes) {
    return NextResponse.json({ error: 'notes field is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('session_summaries')
    .update({ patient_notes_ar: body.notes })
    .eq('session_id', sessionId)
    .eq('patient_id', patient.patientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

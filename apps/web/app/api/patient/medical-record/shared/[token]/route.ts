import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { buildMedicalRecord } from '@/lib/records/build-medical-record';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/medical-record/shared/[token] ───────────────────────────
// Public, token-gated "medical passport" view. No patient cookie — the share
// token (created by POST /api/patient/medical-record/share) resolves the patient.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Invalid share link' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: share } = await supabase
    .from('medical_record_shares')
    .select('patient_id, expires_at')
    .eq('token', token)
    .single();

  if (!share) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
  }
  if (new Date(share.expires_at as string).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Share link expired' }, { status: 410 });
  }

  const patientId = share.patient_id as string;
  const { data: patientRow } = await supabase
    .from('patients')
    .select('name_ar')
    .eq('id', patientId)
    .single();

  const record = await buildMedicalRecord(
    supabase,
    patientId,
    (patientRow?.name_ar as string) ?? 'مريض'
  );
  return NextResponse.json(record);
}

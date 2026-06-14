/**
 * GET    /api/patient/records/[id] — single record detail
 * DELETE /api/patient/records/[id] — soft delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { createServerClient } from '@triaji/shared/supabase';

// ─── GET: Single record ─────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('health_records')
    .select('*')
    .eq('id', id)
    .eq('patient_id', patient.patientId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
  }

  // Generate signed URL for the file
  const { data: signedData } = await supabase.storage
    .from('health-records')
    .createSignedUrl(data.file_url as string, 3600);

  return NextResponse.json({
    record: data,
    fileUrl: signedData?.signedUrl ?? null,
  });
}

// ─── DELETE: Soft delete ────────────────────────────────────────────────────

export async function DELETE(
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
  const { data: existing } = await supabase
    .from('health_records')
    .select('id')
    .eq('id', id)
    .eq('patient_id', patient.patientId)
    .is('deleted_at', null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
  }

  // Soft delete
  const { error } = await supabase
    .from('health_records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

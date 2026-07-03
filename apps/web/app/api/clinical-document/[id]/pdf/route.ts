import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import {
  CLINICAL_DOCUMENTS_BUCKET,
  SIGNED_URL_TTL,
  toStoragePath,
} from '@/lib/clinical-documents/storage';

export const dynamic = 'force-dynamic';

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Resolve the verified doctor account for the request, or null. */
async function authenticateDoctor(request: NextRequest): Promise<{ id: string; doctor_id: string } | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = createServerClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('id, doctor_id, verification_status')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return { id: doctorAccount.id as string, doctor_id: doctorAccount.doctor_id as string };
}

// GET /api/clinical-document/[id]/pdf — authorize, then redirect to a
// short-lived signed URL for the private clinical-documents bucket.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordId } = await params;
  const supabase = createServerClient();

  const { data: record } = await supabase
    .from('health_records')
    .select('id, patient_id, pdf_url, file_url, authored_by, booking_id')
    .eq('id', recordId)
    .is('deleted_at', null)
    .single();

  if (!record) {
    return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 });
  }

  // The caller must be the record's own patient, the authoring doctor, or the
  // doctor on the record's booking. Anonymous callers get 401; authenticated
  // callers without ownership get 404 so record existence isn't leaked.
  const patient = await getAuthenticatedPatient();
  const doctor = patient ? null : await authenticateDoctor(request);

  if (!patient && !doctor) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  let authorized = false;
  if (patient) {
    authorized = record.patient_id === patient.patientId;
  } else if (doctor) {
    if (record.authored_by === doctor.id) {
      authorized = true;
    } else if (record.booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('doctor_id')
        .eq('id', record.booking_id)
        .single();
      authorized = booking?.doctor_id === doctor.doctor_id;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 });
  }

  const stored = (record.pdf_url as string | null) ?? (record.file_url as string | null);
  if (!stored) {
    return NextResponse.json({ error: 'لا يوجد ملف PDF لهذا المستند' }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(CLINICAL_DOCUMENTS_BUCKET)
    .createSignedUrl(toStoragePath(stored), SIGNED_URL_TTL);

  if (signError || !signed?.signedUrl) {
    console.error('[clinical-document/pdf] signing failed:', signError);
    return NextResponse.json({ error: 'تعذر فتح الملف' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@triaji/shared/supabase';

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Resolve the verified doctor account for the request, or null. */
async function authenticateDoctor(request: NextRequest): Promise<{ doctor_id: string } | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = createServerClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('doctor_id, verification_status')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return { doctor_id: doctorAccount.doctor_id as string };
}

// GET /api/admin/bookings/[id]/patient-history — doctor view (consent-gated)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;

  const doctor = await authenticateDoctor(request);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Get booking with doctor and patient info
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, patient_id, doctor_id, appointment_datetime')
    .eq('id', bookingId)
    .single();

  // Only the booking's own doctor may view the patient's history
  if (!booking || booking.doctor_id !== doctor.doctor_id) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Check consent exists and is valid
  const { data: consent } = await supabase
    .from('history_consent')
    .select('id, expires_at, revoked_at')
    .eq('patient_id', booking.patient_id)
    .eq('doctor_id', booking.doctor_id)
    .single();

  if (!consent || consent.revoked_at) {
    return NextResponse.json({
      hasConsent: false,
      message: 'المريض لم يمنح الإذن لعرض السجل الطبي',
    });
  }

  // Check if consent has expired
  if (consent.expires_at && new Date(consent.expires_at as string) < new Date()) {
    return NextResponse.json({
      hasConsent: false,
      message: 'انتهت صلاحية إذن عرض السجل الطبي',
    });
  }

  // Get patient's session summaries
  const { data: summaries } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('patient_id', booking.patient_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    hasConsent: true,
    summaries: summaries ?? [],
  });
}

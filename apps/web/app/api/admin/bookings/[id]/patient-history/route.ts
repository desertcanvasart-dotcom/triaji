import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

// GET /api/admin/bookings/[id]/patient-history — doctor view (consent-gated)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const supabase = createServerClient();

  // Get booking with doctor and patient info
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, patient_id, doctor_id, appointment_datetime')
    .eq('id', bookingId)
    .single();

  if (!booking) {
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

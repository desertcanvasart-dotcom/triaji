import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;

  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, doctors(name_ar, title_ar, photo_url, specialty_id)')
    .eq('id', bookingId)
    .single();

  if (!booking || booking.patient_id !== patient.patientId) {
    return NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 });
  }

  const doctor = booking.doctors as { name_ar: string; title_ar: string; photo_url: string | null; specialty_id: string } | null;

  return NextResponse.json({
    booking: {
      id: booking.id,
      appointment_datetime: booking.appointment_datetime,
      appointment_type: booking.appointment_type,
      status: booking.status,
      livekit_room_name: booking.livekit_room_name,
      patient_id: booking.patient_id,
      doctor_id: booking.doctor_id,
      doctor_name_ar: doctor?.name_ar ?? '',
      doctor_title_ar: doctor?.title_ar ?? '',
      doctor_photo_url: doctor?.photo_url ?? null,
    },
  });
}

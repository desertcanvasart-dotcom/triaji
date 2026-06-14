import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { generateToken } from '@/lib/telehealth/room';

// GET /api/telehealth/token?bookingId=xxx&role=patient|doctor
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get('bookingId');
  const role = searchParams.get('role') as 'patient' | 'doctor' | null;

  if (!bookingId || !role || !['patient', 'doctor'].includes(role)) {
    return NextResponse.json({ error: 'bookingId and role (patient|doctor) are required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Get booking details
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, appointment_datetime, appointment_type, livekit_room_name, patient_id, doctor_id')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 });
  }

  if ((booking.appointment_type as string) !== 'telehealth') {
    return NextResponse.json({ error: 'هذا الحجز ليس استشارة أونلاين' }, { status: 400 });
  }

  // Check appointment time is within +/-30 minutes
  const appointmentTime = new Date(booking.appointment_datetime as string).getTime();
  const now = Date.now();
  const thirtyMin = 30 * 60 * 1000;

  if (now < appointmentTime - thirtyMin || now > appointmentTime + thirtyMin) {
    return NextResponse.json({ error: 'لا يمكن الانضمام إلا خلال 30 دقيقة من الموعد' }, { status: 403 });
  }

  const roomName = (booking.livekit_room_name as string) ?? `triaji-${bookingId}`;

  // Get participant name
  let participantName = 'مشارك';
  if (role === 'patient') {
    const { data: patient } = await supabase
      .from('patients')
      .select('name_ar')
      .eq('id', booking.patient_id)
      .single();
    participantName = (patient?.name_ar as string) ?? 'مريض';
  } else {
    const { data: doctor } = await supabase
      .from('doctors')
      .select('name_ar')
      .eq('id', booking.doctor_id)
      .single();
    participantName = (doctor?.name_ar as string) ?? 'دكتور';
  }

  const token = await generateToken(roomName, participantName, role);

  return NextResponse.json({
    token,
    roomName,
    serverUrl: process.env.LIVEKIT_URL ?? '',
  });
}

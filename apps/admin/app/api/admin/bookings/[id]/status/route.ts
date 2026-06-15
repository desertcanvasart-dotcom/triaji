import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
};

/** PUT /api/admin/bookings/[id]/status — update booking status */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();
  const newStatus: string = body['status'];

  if (!newStatus) {
    return NextResponse.json({ error: 'status is required.' }, { status: 400 });
  }

  // Fetch current booking.
  // `bookings` has no patient_phone/patient_name (join patients) and the slot
  // FK column is slot_id (not availability_slot_id).
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status, doctor_id, appointment_datetime, slot_id, patients:patient_id ( name_ar, phone_number )')
    .eq('id', id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  // Check valid transition
  const allowed = VALID_TRANSITIONS[booking.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot change status from '${booking.status}' to '${newStatus}'.` },
      { status: 400 }
    );
  }

  // For cancellation: check if future appointment
  if (newStatus === 'cancelled') {
    const appointmentDate = new Date(booking.appointment_datetime);
    if (appointmentDate < new Date()) {
      return NextResponse.json(
        { error: 'Cannot cancel a past appointment.' },
        { status: 400 }
      );
    }
  }

  // For complete / no_show: check if past appointment
  if (newStatus === 'completed' || newStatus === 'no_show') {
    const appointmentDate = new Date(booking.appointment_datetime);
    if (appointmentDate > new Date()) {
      return NextResponse.json(
        { error: 'Cannot mark a future appointment as completed or no-show.' },
        { status: 400 }
      );
    }
  }

  // Update booking status
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If cancelled, release the slot
  if (newStatus === 'cancelled' && booking.slot_id) {
    await supabase
      .from('doctor_availability')
      .update({ is_booked: false })
      .eq('id', booking.slot_id);

    // Send cancellation notification (DEV_MODE: log to console)
    const { data: doctor } = await supabase
      .from('doctors')
      .select('name_ar, title_ar')
      .eq('id', booking.doctor_id)
      .single();

    const patient = booking.patients as unknown as { name_ar: string | null; phone_number: string | null } | null;
    const patientPhone = patient?.phone_number ?? null;

    if (doctor && patientPhone) {
      const appointmentDate = new Date(booking.appointment_datetime);
      const dateAr = appointmentDate.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeAr = appointmentDate.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const cancellationMsg = `عذراً، تم إلغاء موعدك مع ${doctor.title_ar} ${doctor.name_ar}\nبتاريخ ${dateAr} الساعة ${timeAr}\n\nلحجز موعد جديد، استخدم ترياچي.\nترياچي 🏥`;

      console.log('[DEV_MODE] Cancellation notification:');
      console.log(`[DEV_MODE] To: ${patientPhone}`);
      console.log(`[DEV_MODE] Message: ${cancellationMsg}`);
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}

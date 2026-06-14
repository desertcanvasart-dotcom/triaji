import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { assignQueueNumber } from '@/lib/clinic/queue-number';

export const dynamic = 'force-dynamic';

/** POST /api/admin/queue/check-in — convert pre-booked patient to queue entry */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const supabase = createAdminClient();
  const tenantId = admin.tenant_id;
  const body = await request.json();
  const { booking_id } = body;

  if (!booking_id || !tenantId) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
  }

  // Fetch booking with patient info
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      patients(id, name_ar, phone_number)
    `)
    .eq('id', booking_id)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Check if already checked in
  const { data: existing } = await supabase
    .from('clinic_queue')
    .select('id')
    .eq('booking_id', booking_id)
    .eq('queue_date', new Date().toISOString().split('T')[0])
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Booking already checked in', message: 'تم تسجيل الحضور مسبقاً' }, { status: 409 });
  }

  // Get queue number
  const queueNumber = await assignQueueNumber(tenantId, booking.doctor_id);

  // Create queue entry from booking
  const patient = booking.patients as { id: string; name_ar: string; phone_number: string } | null;

  const { data: entry, error: insertError } = await supabase
    .from('clinic_queue')
    .insert({
      tenant_id: tenantId,
      doctor_id: booking.doctor_id,
      patient_id: patient?.id ?? booking.patient_id ?? null,
      patient_name_ar: patient?.name_ar ?? booking.patient_name ?? 'مريض',
      patient_phone: patient?.phone_number ?? null,
      queue_number: queueNumber,
      source: 'online_booking',
      booking_id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update booking status to confirmed
  await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking_id);

  return NextResponse.json({ entry, queueNumber });
}

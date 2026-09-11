import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/bookings — list with filters + pagination */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') ?? '';
  const doctor = searchParams.get('doctor') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'appointment_datetime';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('bookings')
    .select(`
      *,
      patients(name_ar, phone_number),
      doctors!inner(id, name_ar, name_en, specialty_id, specialties!inner(name_en, name_ar)),
      triage_sessions!fk_session_booking(id, chief_complaint_ar, determined_specialty_id, urgency_level)
    `, { count: 'exact' })
    .order(sortBy === 'created_at' ? 'created_at' : 'appointment_datetime', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenant) {
    query = query.eq('tenant_id', tenant);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (doctor) {
    query = query.eq('doctor_id', doctor);
  }
  if (dateFrom) {
    query = query.gte('appointment_datetime', dateFrom);
  }
  if (dateTo) {
    query = query.lte('appointment_datetime', dateTo);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the joined patient onto each row (the table reads patient_name/phone).
  const bookings = (data ?? []).map((b) => {
    const patient = Array.isArray(b.patients) ? b.patients[0] : b.patients;
    return {
      ...b,
      patient_name: patient?.name_ar ?? null,
      patient_phone: patient?.phone_number ?? '',
    };
  });

  return NextResponse.json({ bookings, total: count ?? 0, page, limit });
}

/**
 * POST /api/admin/bookings — create a booking manually (receptionist/admin
 * booking a patient into an open slot, no triage session required).
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  const body = await request.json();
  const doctorId: string = body['doctor_id'];
  const slotId: string = body['slot_id'];
  const patientName = (body['patient_name'] ?? '').toString().trim();
  const patientPhone = (body['patient_phone'] ?? '').toString().trim();
  const notes = (body['notes'] ?? '').toString().trim() || null;

  if (!doctorId || !slotId || !patientName || !patientPhone) {
    return NextResponse.json(
      { error: 'doctor_id, slot_id, patient_name and patient_phone are required.' },
      { status: 400 }
    );
  }
  if (!/^01[0-9]{9}$/.test(patientPhone)) {
    return NextResponse.json({ error: 'Enter a valid Egyptian mobile number.' }, { status: 400 });
  }

  // Verify the doctor is in the admin's scope.
  let doctorQuery = supabase.from('doctors').select('id, tenant_id').eq('id', doctorId);
  if (tenant) doctorQuery = doctorQuery.eq('tenant_id', tenant);
  const { data: doctor } = await doctorQuery.single();
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found in your scope.' }, { status: 404 });
  }

  const bookingTenant = tenant ?? (doctor.tenant_id as string | null) ?? null;

  // The slot must belong to this doctor and still be open.
  const { data: slot } = await supabase
    .from('doctor_availability')
    .select('id, slot_datetime, duration_minutes, is_booked')
    .eq('id', slotId)
    .eq('doctor_id', doctorId)
    .single();
  if (!slot) {
    return NextResponse.json({ error: 'Slot not found for this doctor.' }, { status: 404 });
  }
  if (slot.is_booked) {
    return NextResponse.json({ error: 'That slot is already booked.' }, { status: 409 });
  }

  // Find or create the patient (unique on phone_number + tenant_id).
  let patientQuery = supabase.from('patients').select('id').eq('phone_number', patientPhone);
  patientQuery = bookingTenant ? patientQuery.eq('tenant_id', bookingTenant) : patientQuery.is('tenant_id', null);
  const { data: existingPatient } = await patientQuery.maybeSingle();

  let patientId = existingPatient?.id as string | undefined;
  if (!patientId) {
    const { data: newPatient, error: patientError } = await supabase
      .from('patients')
      .insert({ phone_number: patientPhone, name_ar: patientName, tenant_id: bookingTenant })
      .select('id')
      .single();
    if (patientError || !newPatient) {
      return NextResponse.json({ error: patientError?.message ?? 'Could not create patient.' }, { status: 500 });
    }
    patientId = newPatient.id as string;
  }

  // Atomically claim the slot (guards against a concurrent booking).
  const { data: claimed, error: claimError } = await supabase
    .from('doctor_availability')
    .update({ is_booked: true })
    .eq('id', slotId)
    .eq('is_booked', false)
    .select('id');
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'That slot was just booked.' }, { status: 409 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tenant_id: bookingTenant,
      patient_id: patientId,
      doctor_id: doctorId,
      slot_id: slotId,
      appointment_datetime: slot.slot_datetime,
      duration_minutes: slot.duration_minutes ?? 30,
      status: 'confirmed',
      booking_source: 'native',
      notes_ar: notes,
    })
    .select()
    .single();

  if (bookingError) {
    // Roll back the slot claim so it stays bookable.
    await supabase.from('doctor_availability').update({ is_booked: false }).eq('id', slotId);
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  return NextResponse.json({ booking }, { status: 201 });
}

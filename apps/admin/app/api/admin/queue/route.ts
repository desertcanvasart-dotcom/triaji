import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { assignQueueNumber } from '@/lib/clinic/queue-number';
import { sendQueueRegisteredNotification } from '@/lib/clinic/queue-notifications';
import { estimateWaitMinutes } from '@/lib/clinic/estimate-wait';

export const dynamic = 'force-dynamic';

/** GET /api/admin/queue — list queue entries for a doctor on a date */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;

  const doctorId = searchParams.get('doctor_id');
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const status = searchParams.get('status');

  if (!doctorId) {
    return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 });
  }

  let query = supabase
    .from('clinic_queue')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('queue_date', date)
    .order('queue_number', { ascending: true });

  if (tenant) query = query.eq('tenant_id', tenant);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data });
}

/** POST /api/admin/queue — add patient to queue */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const supabase = createAdminClient();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  const body = await request.json();
  const { doctor_id, patient_name_ar, patient_phone, chief_complaint_ar, source, booking_id, patient_id } = body;

  if (!doctor_id || !patient_name_ar) {
    return NextResponse.json({ error: 'doctor_id and patient_name_ar are required' }, { status: 400 });
  }

  // Get next queue number
  const queueNumber = await assignQueueNumber(tenantId, doctor_id);

  // Insert queue entry
  const { data: entry, error } = await supabase
    .from('clinic_queue')
    .insert({
      tenant_id: tenantId,
      doctor_id,
      patient_name_ar,
      patient_phone: patient_phone ?? null,
      patient_id: patient_id ?? null,
      queue_number: queueNumber,
      source: source ?? 'walk_in',
      booking_id: booking_id ?? null,
      chief_complaint_ar: chief_complaint_ar ?? null,
    })
    .select()
    .single();

  if (error) {
    // Retry once on unique constraint violation (race condition)
    if (error.code === '23505') {
      const retryNumber = await assignQueueNumber(tenantId, doctor_id);
      const { data: retryEntry, error: retryError } = await supabase
        .from('clinic_queue')
        .insert({
          tenant_id: tenantId,
          doctor_id,
          patient_name_ar,
          patient_phone: patient_phone ?? null,
          patient_id: patient_id ?? null,
          queue_number: retryNumber,
          source: source ?? 'walk_in',
          booking_id: booking_id ?? null,
          chief_complaint_ar: chief_complaint_ar ?? null,
        })
        .select()
        .single();

      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }

      return NextResponse.json({ entry: retryEntry, queueNumber: retryNumber });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send WhatsApp notification if phone provided
  if (patient_phone) {
    // Get waiting count for estimated wait
    const { count } = await supabase
      .from('clinic_queue')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('doctor_id', doctor_id)
      .eq('queue_date', new Date().toISOString().split('T')[0])
      .eq('status', 'waiting')
      .lt('queue_number', queueNumber);

    // Get tenant config for minutes per patient
    const { data: config } = await supabase
      .from('tenant_config')
      .select('estimated_minutes_per_patient')
      .eq('tenant_id', tenantId)
      .single();

    const minutesPerPatient = config?.estimated_minutes_per_patient ?? 15;
    const waitMinutes = estimateWaitMinutes(count ?? 0, minutesPerPatient);

    // Get doctor name
    const { data: doctor } = await supabase
      .from('doctors')
      .select('name_ar, title_ar')
      .eq('id', doctor_id)
      .single();

    // Get clinic name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name_ar')
      .eq('id', tenantId)
      .single();

    try {
      await sendQueueRegisteredNotification(patient_phone, queueNumber, waitMinutes);
    } catch {
      // Non-blocking — notification failure should not block queue add
    }
  }

  return NextResponse.json({ entry, queueNumber });
}

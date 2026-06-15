import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/lab/appointments — list appointments for today */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;

  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const status = searchParams.get('status');

  // appointment_date/time were merged into a single appointment_datetime column;
  // select a day by range.
  let query = supabase
    .from('lab_appointments')
    .select('*')
    .gte('appointment_datetime', `${date}T00:00:00`)
    .lte('appointment_datetime', `${date}T23:59:59.999`)
    .order('appointment_datetime', { ascending: true });

  if (tenant) query = query.eq('lab_tenant_id', tenant);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointments: data });
}

/** POST /api/admin/lab/appointments — create appointment (walk-in or scheduled) */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  const body = await request.json();
  const {
    patient_name_ar,
    patient_phone,
    patient_id,
    appointment_date,
    appointment_time,
    source,
    order_routing_id,
    notes,
  } = body;

  if (!patient_name_ar) {
    return NextResponse.json({ error: 'patient_name_ar is required' }, { status: 400 });
  }

  // appointment_date/time → appointment_datetime; source → is_walk_in; notes → notes_ar;
  // order_routing_id → lab_order_routing_id; tenant_id → lab_tenant_id.
  const appointmentDatetime = appointment_date
    ? (appointment_time ? `${appointment_date}T${appointment_time}` : appointment_date)
    : new Date().toISOString();

  const { data, error } = await supabase
    .from('lab_appointments')
    .insert({
      lab_tenant_id: tenantId,
      patient_name_ar,
      patient_phone: patient_phone ?? null,
      patient_id: patient_id ?? null,
      appointment_datetime: appointmentDatetime,
      is_walk_in: source ? source === 'walk_in' : true,
      is_home_collection: false,
      lab_order_routing_id: order_routing_id ?? null,
      notes_ar: notes ?? null,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointment: data }, { status: 201 });
}

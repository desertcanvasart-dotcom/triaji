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

  let query = supabase
    .from('lab_appointments')
    .select('*')
    .eq('appointment_date', date)
    .order('appointment_time', { ascending: true });

  if (tenant) query = query.eq('tenant_id', tenant);
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

  const { data, error } = await supabase
    .from('lab_appointments')
    .insert({
      tenant_id: tenantId,
      patient_name_ar,
      patient_phone: patient_phone ?? null,
      patient_id: patient_id ?? null,
      appointment_date: appointment_date ?? new Date().toISOString().split('T')[0],
      appointment_time: appointment_time ?? null,
      source: source ?? 'walk_in',
      order_routing_id: order_routing_id ?? null,
      notes: notes ?? null,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointment: data }, { status: 201 });
}

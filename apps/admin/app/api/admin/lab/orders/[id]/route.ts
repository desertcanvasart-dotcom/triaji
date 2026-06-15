import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/lab/orders/[id] — single order with items */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { id } = await params;

  // patient/doctor come from the routing's own FKs; ordered tests are nested under
  // health_records (no direct routing→items relationship); results are in lab_values.
  let query = supabase
    .from('lab_order_routing')
    .select(`
      *,
      health_records!lab_order_routing_health_record_id_fkey(record_type, lab_values, lab_order_items(id, test_name_ar, test_name_en, urgency, notes_ar)),
      patients:patient_id(name_ar, phone_number),
      doctors:doctor_id(name_ar)
    `)
    .eq('id', id);

  if (tenant) query = query.eq('lab_tenant_id', tenant);

  const { data, error } = await query.single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  }

  return NextResponse.json({ order: data });
}

/** PUT /api/admin/lab/orders/[id] — update order status */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { id } = await params;
  const body = await request.json();

  const { status, notes } = body;

  if (!status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  const validStatuses = ['pending', 'accepted', 'sample_collected', 'processing', 'results_ready', 'delivered', 'rejected'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  // lab_order_routing stores notes in routing_note_ar (no `notes` column).
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes !== undefined) update.routing_note_ar = notes;

  let query = supabase
    .from('lab_order_routing')
    .update(update)
    .eq('id', id);

  if (tenant) query = query.eq('lab_tenant_id', tenant);

  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ order: data });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/lab/orders — list incoming orders for this lab tenant */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;

  const status = searchParams.get('status');
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = (page - 1) * limit;

  // patient/doctor come from the routing's own FKs; ordered tests live in lab_order_items
  // (nested under health_records — there is no direct routing→items relationship); results
  // live in health_records.lab_values, not on lab_order_items.
  let query = supabase
    .from('lab_order_routing')
    .select(`
      *,
      health_records!lab_order_routing_health_record_id_fkey!inner(record_type, lab_order_items(id, test_name_ar, test_name_en, urgency)),
      patients:patient_id(name_ar, phone_number),
      doctors:doctor_id(name_ar)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenant) query = query.eq('lab_tenant_id', tenant);
  if (status) query = query.eq('status', status);
  if (date) query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data, total: count, page, limit });
}

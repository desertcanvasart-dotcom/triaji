import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/lab/services/[id] — update a lab service */
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

  // Map accepted client field names to the real lab_services columns.
  // (price→price_egp, sample_type→sample_type_ar, category→category_ar;
  //  turnaround_hours has no column on lab_services and is dropped.)
  const fieldToColumn: Record<string, string> = {
    name_ar: 'name_ar',
    name_en: 'name_en',
    price: 'price_egp',
    sample_type: 'sample_type_ar',
    category: 'category_ar',
    is_active: 'is_active',
  };
  const update: Record<string, unknown> = {};

  for (const [field, column] of Object.entries(fieldToColumn)) {
    if (body[field] !== undefined) {
      update[column] = body[field];
    }
  }

  let query = supabase
    .from('lab_services')
    .update(update)
    .eq('id', id);

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  }

  return NextResponse.json({ service: data });
}

/** DELETE /api/admin/lab/services/[id] — deactivate a lab service (soft delete) */
export async function DELETE(
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

  let query = supabase
    .from('lab_services')
    .update({ is_active: false })
    .eq('id', id);

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  }

  return NextResponse.json({ service: data });
}

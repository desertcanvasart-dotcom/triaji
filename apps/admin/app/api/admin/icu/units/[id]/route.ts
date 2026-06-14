import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireIcuAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/icu/units/[id] — update unit details */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const icuCheck = requireIcuAccess(admin);
  if (icuCheck) return icuCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    'unit_name_ar',
    'unit_name_en',
    'floor_ar',
    'floor_en',
    'phone_direct',
    'accepts_transfers',
    'is_active',
    'closure_reason_ar',
    'total_beds',
  ];

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      update[field] = body[field];
    }
  }

  let query = supabase
    .from('icu_units')
    .update(update)
    .eq('id', id);

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 500 }
    );
  }

  return NextResponse.json({ unit: data });
}

/** DELETE /api/admin/icu/units/[id] — soft delete (set is_active=false) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const icuCheck = requireIcuAccess(admin);
  if (icuCheck) return icuCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { id } = await params;

  let query = supabase
    .from('icu_units')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 500 }
    );
  }

  return NextResponse.json({ unit: data });
}

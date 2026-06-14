import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/pharmacy/medications/[id] — update medication */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const { id } = await params;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const body = await request.json();

  const update: Record<string, unknown> = {};

  if (body.name_ar !== undefined) update.name_ar = body.name_ar;
  if (body.name_en !== undefined) update.name_en = body.name_en;
  if (body.generic_name !== undefined) update.generic_name = body.generic_name;
  if (body.barcode !== undefined) update.barcode = body.barcode;
  if (body.category !== undefined) update.category = body.category;
  if (body.form !== undefined) update.form = body.form;
  if (body.strength !== undefined) update.strength = body.strength;
  if (body.unit !== undefined) update.unit = body.unit;
  if (body.price !== undefined) update.price = body.price;
  if (body.stock_quantity !== undefined) update.stock_quantity = body.stock_quantity;
  if (body.min_stock_level !== undefined) update.min_stock_level = body.min_stock_level;
  if (body.requires_prescription !== undefined) update.requires_prescription = body.requires_prescription;
  if (body.storage_conditions !== undefined) update.storage_conditions = body.storage_conditions;
  if (body.manufacturer !== undefined) update.manufacturer = body.manufacturer;

  let updateQuery = supabase.from('pharmacy_medications').update(update).eq('id', id);
  if (tenant) updateQuery = updateQuery.eq('tenant_id', tenant);

  const { data, error } = await updateQuery.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ medication: data });
}

/** DELETE /api/admin/pharmacy/medications/[id] — soft deactivate medication */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const { id } = await params;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  let updateQuery = supabase
    .from('pharmacy_medications')
    .update({ is_active: false })
    .eq('id', id);
  if (tenant) updateQuery = updateQuery.eq('tenant_id', tenant);

  const { data, error } = await updateQuery.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ medication: data });
}

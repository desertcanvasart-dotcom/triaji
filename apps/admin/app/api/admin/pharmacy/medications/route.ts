import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/pharmacy/medications — list pharmacy medications */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;

  const activeOnly = searchParams.get('active') !== 'false';
  const search = searchParams.get('search');
  const category = searchParams.get('category');

  let query = supabase
    .from('pharmacy_medications')
    .select('*')
    .order('name_ar', { ascending: true });

  if (tenant) query = query.eq('tenant_id', tenant);
  if (activeOnly) query = query.eq('is_active', true);
  if (category) query = query.eq('category', category);
  if (search) query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%,barcode.ilike.%${search}%`);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ medications: data });
}

/** POST /api/admin/pharmacy/medications — add a medication */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const supabase = createAdminClient();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  const body = await request.json();
  const {
    catalog_medication_id, name_ar, name_en, generic_name, barcode,
    category, form, strength, unit, price, stock_quantity,
    min_stock_level, requires_prescription, storage_conditions, manufacturer,
  } = body;

  if (!name_ar) {
    return NextResponse.json({ error: 'name_ar is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('pharmacy_medications')
    .insert({
      tenant_id: tenantId,
      catalog_medication_id: catalog_medication_id ?? null,
      name_ar,
      name_en: name_en ?? null,
      generic_name: generic_name ?? null,
      barcode: barcode ?? null,
      category: category ?? null,
      form: form ?? null,
      strength: strength ?? null,
      unit: unit ?? null,
      price: price ?? null,
      stock_quantity: stock_quantity ?? 0,
      min_stock_level: min_stock_level ?? 0,
      requires_prescription: requires_prescription ?? true,
      storage_conditions: storage_conditions ?? null,
      manufacturer: manufacturer ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ medication: data }, { status: 201 });
}

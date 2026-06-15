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

  let query = supabase
    .from('pharmacy_medications')
    .select('*')
    .order('drug_name_ar', { ascending: true });

  if (tenant) query = query.eq('tenant_id', tenant);
  if (activeOnly) query = query.eq('is_active', true);
  if (search) query = query.or(`drug_name_ar.ilike.%${search}%,drug_name_en.ilike.%${search}%,generic_name_en.ilike.%${search}%`);

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
    name_ar, name_en, generic_name, form, strength, price,
    stock_quantity, requires_prescription, manufacturer,
  } = body;

  if (!name_ar) {
    return NextResponse.json({ error: 'name_ar is required' }, { status: 400 });
  }

  const stock = stock_quantity ?? 0;

  const { data, error } = await supabase
    .from('pharmacy_medications')
    .insert({
      tenant_id: tenantId,
      drug_name_ar: name_ar,
      drug_name_en: name_en ?? null,
      generic_name_en: generic_name ?? null,
      form_ar: form ?? null,
      strength: strength ?? null,
      price_egp: price ?? null,
      stock_quantity: stock,
      in_stock: stock > 0,
      requires_prescription: requires_prescription ?? true,
      manufacturer_ar: manufacturer ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ medication: data }, { status: 201 });
}

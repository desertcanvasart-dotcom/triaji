import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireIcuAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/icu/units — list hospital's ICU units scoped to admin's tenant_id */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const icuCheck = requireIcuAccess(admin);
  if (icuCheck) return icuCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  let query = supabase
    .from('icu_units')
    .select('*')
    .order('unit_type', { ascending: true });

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ units: data });
}

/** POST /api/admin/icu/units — create a new ICU unit */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const icuCheck = requireIcuAccess(admin);
  if (icuCheck) return icuCheck;

  const tenantId = admin.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  const {
    unit_type,
    unit_name_ar,
    unit_name_en,
    total_beds,
    floor_ar,
    floor_en,
    phone_direct,
    accepts_transfers,
  } = body;

  if (!unit_type || !unit_name_ar || !total_beds) {
    return NextResponse.json(
      { error: 'unit_type, unit_name_ar, and total_beds are required' },
      { status: 400 }
    );
  }

  if (total_beds < 1 || total_beds > 200) {
    return NextResponse.json(
      { error: 'total_beds must be between 1 and 200' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('icu_units')
    .insert({
      tenant_id: tenantId,
      unit_type,
      unit_name_ar,
      unit_name_en: unit_name_en ?? null,
      total_beds,
      available_beds: 0,
      floor_ar: floor_ar ?? null,
      floor_en: floor_en ?? null,
      phone_direct: phone_direct ?? null,
      accepts_transfers: accepts_transfers ?? true,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ unit: data }, { status: 201 });
}

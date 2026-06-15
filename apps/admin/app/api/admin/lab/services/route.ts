import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/lab/services — list lab services for this tenant */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;

  const activeOnly = searchParams.get('active') !== 'false';

  let query = supabase
    .from('lab_services')
    .select('*')
    .order('name_ar', { ascending: true });

  if (tenant) query = query.eq('tenant_id', tenant);
  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ services: data });
}

/** POST /api/admin/lab/services — add a lab service (from catalog or custom) */
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
  const { name_ar, name_en, price, sample_type, category } = body;

  if (!name_ar) {
    return NextResponse.json({ error: 'name_ar is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('lab_services')
    .insert({
      tenant_id: tenantId,
      name_ar,
      name_en: name_en ?? null,
      price_egp: price ?? null,
      sample_type_ar: sample_type ?? null,
      category_ar: category ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ service: data }, { status: 201 });
}

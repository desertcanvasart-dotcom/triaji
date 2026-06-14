import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireIcuAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/icu/transfers — list incoming transfer requests for this hospital */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const icuCheck = requireIcuAccess(admin);
  if (icuCheck) return icuCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;
  const statusFilter = searchParams.get('status');

  let query = supabase
    .from('icu_transfer_requests')
    .select(`
      *,
      icu_unit:icu_units(id, unit_name_ar, unit_name_en, unit_type, available_beds, total_beds)
    `)
    .order('created_at', { ascending: false });

  if (tenant) {
    query = query.eq('receiving_tenant_id', tenant);
  }

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transfers: data });
}

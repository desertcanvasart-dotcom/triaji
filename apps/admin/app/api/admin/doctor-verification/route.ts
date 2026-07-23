import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/doctor-verification — list doctor registrations */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;

  // Only platform admins can access verification
  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required.' },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') ?? 'pending';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '25', 10);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('doctor_accounts')
    .select('*, governorates(name_ar, name_en)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    query = query.eq('verification_status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve requested-facility names for existing_clinic requests (the column
  // exists once migration 064 is applied; absent before that).
  const registrations = (data ?? []) as Array<Record<string, unknown>>;
  const requestedIds = [
    ...new Set(registrations.map((r) => r['requested_tenant_id']).filter(Boolean)),
  ] as string[];
  if (requestedIds.length > 0) {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name_en')
      .in('id', requestedIds);
    const names = new Map((tenants ?? []).map((t) => [t.id, t.name_en]));
    for (const r of registrations) {
      const tid = r['requested_tenant_id'] as string | null;
      if (tid && names.has(tid)) r['tenants'] = { name_en: names.get(tid) };
    }
  }

  return NextResponse.json({
    registrations,
    total: count ?? 0,
    page,
    limit,
  });
}

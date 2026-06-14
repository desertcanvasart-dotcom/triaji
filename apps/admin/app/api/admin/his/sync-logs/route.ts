/**
 * GET /api/admin/his/sync-logs — Paginated sync log
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;

  if (!admin.tenant_id) {
    return NextResponse.json(
      { error: 'Platform admins must specify a tenant context' },
      { status: 400 }
    );
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  const { data, count, error } = await supabase
    .from('his_sync_logs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', admin.tenant_id)
    .order('sync_started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}

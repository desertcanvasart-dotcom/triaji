import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/provider-approvals — pending (inactive) facilities awaiting
 * platform-admin approval, each with its pending admin user. These are what the
 * public /register/provider flow creates (tenant + admin user, is_active=false).
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name_en, name_ar, slug, tier, created_at')
    .eq('is_active', false)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (tenants ?? []).map((t) => t.id);
  let users: Array<{ tenant_id: string; name: string; email: string; role: string }> = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('admin_users')
      .select('tenant_id, name, email, role')
      .in('tenant_id', ids)
      .eq('is_active', false);
    users = (data ?? []) as typeof users;
  }

  const byTenant = new Map<string, (typeof users)[number]>();
  for (const u of users) if (!byTenant.has(u.tenant_id)) byTenant.set(u.tenant_id, u);

  const pending = (tenants ?? []).map((t) => ({ ...t, admin_user: byTenant.get(t.id) ?? null }));

  return NextResponse.json({ pending });
}

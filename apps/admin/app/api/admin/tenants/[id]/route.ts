import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/tenants/[id] — tenant detail with config */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const [tenantRes, configRes, doctorsRes, bookingsRes, adminsRes] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', id).single(),
    supabase.from('tenant_config').select('*').eq('tenant_id', id).single(),
    supabase.from('doctors').select('id, name_ar, name_en, is_active, specialty_id, specialties!inner(name_en)').eq('tenant_id', id),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', id),
    supabase.from('admin_users').select('*').eq('tenant_id', id),
  ]);

  if (tenantRes.error || !tenantRes.data) {
    return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
  }

  return NextResponse.json({
    tenant: tenantRes.data,
    config: configRes.data,
    doctors: doctorsRes.data ?? [],
    booking_count: bookingsRes.count ?? 0,
    admins: adminsRes.data ?? [],
  });
}

/** PUT /api/admin/tenants/[id] — update tenant */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const tenantUpdate: Record<string, unknown> = {};
  const tenantFields = ['name_ar', 'name_en', 'slug', 'tier', 'is_active'];
  for (const f of tenantFields) {
    if (body[f] !== undefined) tenantUpdate[f] = body[f];
  }

  if (Object.keys(tenantUpdate).length > 0) {
    const { error } = await supabase.from('tenants').update(tenantUpdate).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update config if provided
  if (body['config']) {
    const configUpdate: Record<string, unknown> = {};
    const configFields = ['logo_url', 'primary_color', 'welcome_message_ar', 'widget_domains', 'booking_mode', 'whatsapp_number'];
    for (const f of configFields) {
      if (body['config'][f] !== undefined) configUpdate[f] = body['config'][f];
    }
    if (Object.keys(configUpdate).length > 0) {
      await supabase.from('tenant_config').update(configUpdate).eq('tenant_id', id);
    }
  }

  return NextResponse.json({ success: true });
}

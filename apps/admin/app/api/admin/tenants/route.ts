import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/tenants — list tenants with stats */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = request.nextUrl;
  const tier = searchParams.get('tier') ?? '';

  let query = supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (tier) {
    query = query.eq('tier', tier);
  }

  const { data: tenants, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with stats. Primary path: one tenant_list_stats RPC (migration
  // 062) returns both counts for all tenants; falls back to the legacy
  // 2-queries-per-tenant path until the migration is applied live.
  const tenantRows = tenants ?? [];
  const bookingsSince = new Date(Date.now() - 30 * 86400000).toISOString();

  let statsById: Map<string, { doctor_count: number; bookings_30d: number }> | null = null;

  if (tenantRows.length > 0) {
    const { data: stats, error: statsError } = await supabase.rpc('tenant_list_stats', {
      p_tenant_ids: tenantRows.map((t) => t.id),
      p_bookings_since: bookingsSince,
    });

    if (!statsError && stats) {
      statsById = new Map(
        (stats as Array<{ tenant_id: string; doctor_count: number; bookings_30d: number }>).map(
          (s) => [s.tenant_id, { doctor_count: Number(s.doctor_count), bookings_30d: Number(s.bookings_30d) }]
        )
      );
    } else {
      console.warn('[admin/tenants] tenant_list_stats RPC unavailable, using legacy path:', statsError?.message);
    }
  }

  const enriched = statsById
    ? tenantRows.map((tenant) => ({
        ...tenant,
        doctor_count: statsById.get(tenant.id)?.doctor_count ?? 0,
        bookings_30d: statsById.get(tenant.id)?.bookings_30d ?? 0,
      }))
    : await Promise.all(
        tenantRows.map(async (tenant) => {
          const [doctorsRes, bookingsRes] = await Promise.all([
            supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
            supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).gte('created_at', bookingsSince),
          ]);

          return {
            ...tenant,
            doctor_count: doctorsRes.count ?? 0,
            bookings_30d: bookingsRes.count ?? 0,
          };
        })
      );

  return NextResponse.json({ tenants: enriched });
}

/** POST /api/admin/tenants — create tenant */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  if (!body['name_en'] || !body['slug']) {
    return NextResponse.json({ error: 'name_en and slug are required.' }, { status: 400 });
  }

  const slug = body['slug'].toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (slug !== body['slug']) {
    return NextResponse.json({ error: 'Slug must be lowercase, alphanumeric with hyphens only.' }, { status: 400 });
  }

  // Check slug uniqueness
  const { data: existing } = await supabase.from('tenants').select('id').eq('slug', slug).single();
  if (existing) {
    return NextResponse.json({ error: 'Slug already taken.' }, { status: 409 });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({
      name_ar: body['name_ar'] ?? body['name_en'],
      name_en: body['name_en'],
      slug,
      tier: body['tier'] ?? 'basic',
      is_active: body['is_active'] ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create default tenant_config
  await supabase.from('tenant_config').insert({
    tenant_id: tenant.id,
    primary_color: '#0D7A7A',
    welcome_message_ar: 'أهلاً بيك في دكتور تريو! أنا هنا أساعدك تلاقي الدكتور المناسب.',
    booking_mode: 'native',
  });

  return NextResponse.json({ tenant }, { status: 201 });
}

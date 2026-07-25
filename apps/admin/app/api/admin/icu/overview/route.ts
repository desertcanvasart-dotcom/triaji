import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Region code to English display name mapping */
const REGION_LABELS: Record<string, string> = {
  cairo_metro: 'Greater Cairo',
  delta: 'Delta',
  upper_egypt: 'Upper Egypt',
  canal: 'Canal Zone',
  sinai: 'Sinai',
  border: 'Border Regions',
};

/** GET /api/admin/icu/overview — platform admin national ICU overview */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  // Platform admin only
  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. Platform admin access required.' },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();

  try {
    // Fetch all active ICU units joined with tenant_config → governorates for region
    const { data: units, error: unitsError } = await supabase
      .from('icu_units')
      .select(`
        id,
        tenant_id,
        unit_type,
        total_beds,
        available_beds,
        is_active,
        tenants!inner (
          tenant_config!inner (
            default_governorate_id,
            governorates!inner (
              region,
              name_en
            )
          )
        )
      `)
      .eq('is_active', true);

    if (unitsError) {
      return NextResponse.json({ error: unitsError.message }, { status: 500 });
    }

    // Supabase returns !inner joins as nested objects; cast through unknown
    const rows = (units ?? []) as unknown as Array<Record<string, any>>;

    // ── Aggregate totals ──
    let totalBeds = 0;
    let availableBeds = 0;

    const regionMap = new Map<string, { totalBeds: number; availableBeds: number }>();
    const unitTypeMap = new Map<string, { totalBeds: number; availableBeds: number }>();

    for (const row of rows) {
      const rowTotalBeds = Number(row.total_beds) || 0;
      const rowAvailableBeds = Number(row.available_beds) || 0;
      totalBeds += rowTotalBeds;
      availableBeds += rowAvailableBeds;

      // icu_units has no direct FK to tenant_config; the path is icu_units → tenants →
      // tenant_config → governorates. Each level may be object or array per Supabase version.
      const tn = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
      const tc = Array.isArray(tn?.tenant_config) ? tn.tenant_config[0] : tn?.tenant_config;
      const gov = tc?.governorates;
      const govObj = Array.isArray(gov) ? gov[0] : gov;
      const region = (govObj?.region as string) ?? 'unknown';
      const regionAgg = regionMap.get(region) ?? { totalBeds: 0, availableBeds: 0 };
      regionAgg.totalBeds += rowTotalBeds;
      regionAgg.availableBeds += rowAvailableBeds;
      regionMap.set(region, regionAgg);

      const unitType = String(row.unit_type ?? 'unknown');
      const typeAgg = unitTypeMap.get(unitType) ?? { totalBeds: 0, availableBeds: 0 };
      typeAgg.totalBeds += rowTotalBeds;
      typeAgg.availableBeds += rowAvailableBeds;
      unitTypeMap.set(unitType, typeAgg);
    }

    const occupiedBeds = totalBeds - availableBeds;
    const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // ── By region ──
    const byRegion = Array.from(regionMap.entries()).map(([region, agg]) => ({
      region: REGION_LABELS[region] ?? region,
      totalBeds: agg.totalBeds,
      availableBeds: agg.availableBeds,
      occupancyPct:
        agg.totalBeds > 0
          ? Math.round(((agg.totalBeds - agg.availableBeds) / agg.totalBeds) * 100)
          : 0,
    }));

    // ── By unit type ──
    const byUnitType = Array.from(unitTypeMap.entries()).map(([unitType, agg]) => ({
      unitType,
      totalBeds: agg.totalBeds,
      availableBeds: agg.availableBeds,
    }));

    // ── Recent transfers (last 24h) ──
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentTransfers } = await supabase
      .from('icu_transfer_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    return NextResponse.json({
      totalBeds,
      availableBeds,
      occupiedBeds,
      occupancyPct,
      byRegion,
      byUnitType,
      recentTransfers: recentTransfers ?? 0,
    });
  } catch (err) {
    console.error('[ICU Overview API]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

export const dynamic = 'force-dynamic';

// ─── GET /api/lab/nearby ────────────────────────────────────────────────────
// Public endpoint — returns nearby labs/radiology centers
// Query params: service_type (lab_test|radiology), governorate_id (optional),
//               lat / lng (optional patient coordinates for distance sorting)
//
// Primary path: the find_labs_near PostGIS RPC (migration 060) — distance is
// computed, sorted, and limited in the DB. Until that migration is applied to
// the live database the route falls back to the legacy query + app-side
// haversine sort, so behavior is unchanged either way.
//
// Location/contact/config live on tenant_config (one row per tenant, joined by
// tenant_id), NOT on tenants.

const MAX_RESULTS = 50;

/** Haversine distance in km between two lat/lng points (legacy fallback) */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type LabConfigRow = {
  default_governorate_id: string | null;
  address_ar: string | null;
  address_en: string | null;
  clinic_phone: string | null;
  phone_number: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
  working_days: unknown;
  logo_url: string | null;
  accepts_insurance: boolean | null;
  delivery_available: boolean | null;
  accepts_walk_ins: boolean | null;
  turnaround_hours: number | null;
  home_collection: boolean | null;
  home_collection_fee_egp: number | null;
  lab_type: string | null;
  accreditation_number: string | null;
};

type LabRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string | null;
  tier: string;
  is_active: boolean;
  tenant_config: LabConfigRow | LabConfigRow[] | null;
};

type RpcLabRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string | null;
  tier: string;
  is_active: boolean;
  config: LabConfigRow | null;
  distance_km: number | null;
};

/** Flatten a tenant + its config into the API response shape. */
function toLabResponse(
  t: { id: string; name_ar: string; name_en: string | null; slug: string | null; tier: string; is_active: boolean },
  cfg: LabConfigRow | null,
  distanceKm: number | null
) {
  return {
    id: t.id,
    name_ar: t.name_ar,
    name_en: t.name_en,
    slug: t.slug,
    tier: t.tier,
    is_active: t.is_active,
    governorate_id: cfg?.default_governorate_id ?? null,
    address_ar: cfg?.address_ar ?? null,
    address_en: cfg?.address_en ?? null,
    phone: cfg?.clinic_phone ?? cfg?.phone_number ?? null,
    latitude: cfg?.latitude ?? null,
    longitude: cfg?.longitude ?? null,
    opening_time: cfg?.opening_time ?? null,
    closing_time: cfg?.closing_time ?? null,
    working_days: cfg?.working_days ?? null,
    logo_url: cfg?.logo_url ?? null,
    accepts_insurance: cfg?.accepts_insurance ?? null,
    delivery_available: cfg?.delivery_available ?? null,
    accepts_walk_ins: cfg?.accepts_walk_ins ?? null,
    turnaround_hours: cfg?.turnaround_hours ?? null,
    home_collection: cfg?.home_collection ?? null,
    home_collection_fee_egp: cfg?.home_collection_fee_egp ?? null,
    lab_type: cfg?.lab_type ?? null,
    accreditation_number: cfg?.accreditation_number ?? null,
    distance_km: distanceKm,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('service_type');
    const governorateId = searchParams.get('governorate_id');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Map service_type to tenant tier
    let tierFilter: string[];
    if (serviceType === 'lab_test') {
      tierFilter = ['lab'];
    } else if (serviceType === 'radiology') {
      tierFilter = ['radiology'];
    } else {
      // Return both if not specified
      tierFilter = ['lab', 'radiology'];
    }

    const userLat = lat ? parseFloat(lat) : NaN;
    const userLng = lng ? parseFloat(lng) : NaN;
    const hasCoords = !Number.isNaN(userLat) && !Number.isNaN(userLng);

    const supabase = createServerClient();

    // Primary path: PostGIS RPC — distance computed/sorted/limited in the DB.
    const { data: rpcData, error: rpcError } = await supabase.rpc('find_labs_near', {
      p_tiers: tierFilter,
      p_lat: hasCoords ? userLat : null,
      p_lng: hasCoords ? userLng : null,
      p_governorate_id: governorateId ?? null,
      p_limit: MAX_RESULTS,
    });

    if (!rpcError) {
      const labs = ((rpcData ?? []) as RpcLabRow[]).map((r) =>
        toLabResponse(r, r.config, r.distance_km)
      );
      return NextResponse.json({ labs });
    }

    // Fallback: migration 060 not applied yet — legacy query + JS haversine.
    console.warn('[lab/nearby] find_labs_near RPC unavailable, using legacy path:', rpcError.message);

    let query = supabase
      .from('tenants')
      .select(`
        id,
        name_ar,
        name_en,
        slug,
        tier,
        is_active,
        tenant_config (
          default_governorate_id,
          address_ar,
          address_en,
          clinic_phone,
          phone_number,
          latitude,
          longitude,
          opening_time,
          closing_time,
          working_days,
          logo_url,
          accepts_insurance,
          delivery_available,
          accepts_walk_ins,
          turnaround_hours,
          home_collection,
          home_collection_fee_egp,
          lab_type,
          accreditation_number
        )
      `)
      .in('tier', tierFilter)
      .eq('is_active', true);

    // Governorate filter lives on tenant_config.default_governorate_id.
    if (governorateId) {
      query = query.eq('tenant_config.default_governorate_id', governorateId);
    }

    const { data, error } = await query.order('name_ar', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'فشل في جلب المعامل' },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as unknown as LabRow[];

    let labs = rows
      .filter((t) => {
        // When filtering by governorate, drop tenants whose config didn't match
        // the embedded filter (Supabase returns the tenant with an empty config
        // array in that case).
        if (!governorateId) return true;
        const c = t.tenant_config;
        return Array.isArray(c) ? c.length > 0 : c != null;
      })
      .map((t) => {
        const cfg = Array.isArray(t.tenant_config) ? (t.tenant_config[0] ?? null) : (t.tenant_config ?? null);
        return toLabResponse(t, cfg, null);
      });

    // If patient coords supplied, compute haversine distance from tenant_config
    // latitude/longitude and sort ascending. Tenants with null coords go last.
    if (hasCoords) {
      labs = labs
        .map((l) => ({
          ...l,
          distance_km:
            l.latitude != null && l.longitude != null
              ? haversineKm(userLat, userLng, l.latitude, l.longitude)
              : null,
        }))
        .sort((a, b) => {
          if (a.distance_km === null) return 1;
          if (b.distance_km === null) return -1;
          return a.distance_km - b.distance_km;
        });
    }

    return NextResponse.json({ labs });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

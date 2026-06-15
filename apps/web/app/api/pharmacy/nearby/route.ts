import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Haversine distance in km between two lat/lng points */
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

type PharmacyConfigRow = {
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
  delivery_fee_egp: number | null;
  delivery_radius_km: number | null;
  pharmacy_type: string | null;
};

type PharmacyRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
  tier: string;
  is_active: boolean;
  tenant_config: PharmacyConfigRow | PharmacyConfigRow[] | null;
};

/**
 * GET /api/pharmacy/nearby — public, find pharmacies by governorate_id and/or
 * patient coordinates.
 * Query tenants with tier='pharmacy'; location/contact/config live on
 * tenant_config (one row per tenant, joined by tenant_id). The embed returns an
 * array; we read [0].
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = request.nextUrl;

    const governorateId = searchParams.get('governorate_id');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    let query = supabase
      .from('tenants')
      .select(`
        id,
        name_ar,
        name_en,
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
          delivery_fee_egp,
          delivery_radius_km,
          pharmacy_type
        )
      `)
      .eq('tier', 'pharmacy')
      .eq('is_active', true)
      .order('name_ar', { ascending: true });

    // Governorate filter lives on tenant_config.default_governorate_id.
    if (governorateId) {
      query = query.eq('tenant_config.default_governorate_id', governorateId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as PharmacyRow[];

    // Flatten the tenant_config embed (array → [0]) and surface contact/location.
    let pharmacies = rows
      .filter((t) => {
        // When filtering by governorate, drop tenants whose config didn't match
        // the embedded filter (Supabase returns an empty config array then).
        if (!governorateId) return true;
        const c = t.tenant_config;
        return Array.isArray(c) ? c.length > 0 : c != null;
      })
      .map((t) => {
        const cfg = Array.isArray(t.tenant_config) ? (t.tenant_config[0] ?? null) : (t.tenant_config ?? null);
        return {
          id: t.id,
          name_ar: t.name_ar,
          name_en: t.name_en,
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
          delivery_fee_egp: cfg?.delivery_fee_egp ?? null,
          delivery_radius_km: cfg?.delivery_radius_km ?? null,
          pharmacy_type: cfg?.pharmacy_type ?? null,
          distance_km: null as number | null,
        };
      });

    // If patient coords supplied, compute haversine distance from tenant_config
    // latitude/longitude and sort ascending. Tenants with null coords go last.
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      if (!Number.isNaN(userLat) && !Number.isNaN(userLng)) {
        pharmacies = pharmacies
          .map((p) => {
            const hasCoords = p.latitude != null && p.longitude != null;
            return {
              ...p,
              distance_km: hasCoords
                ? haversineKm(userLat, userLng, p.latitude!, p.longitude!)
                : null,
            };
          })
          .sort((a, b) => {
            if (a.distance_km === null) return 1;
            if (b.distance_km === null) return -1;
            return a.distance_km - b.distance_km;
          });
      }
    }

    return NextResponse.json({ pharmacies });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

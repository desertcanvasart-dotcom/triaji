import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * GET /api/pharmacy/nearby — public, find pharmacies by governorate_id
 * Query tenants with tier='pharmacy'
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
      .select('id, name_ar, name_en, address_ar, address_en, phone, governorate_id, location, working_hours, is_active, delivery_available, accepts_insurance')
      .eq('tier', 'pharmacy')
      .eq('is_active', true)
      .order('name_ar', { ascending: true });

    if (governorateId) {
      query = query.eq('governorate_id', governorateId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let pharmacies = data ?? [];

    // If lat/lng provided, sort by distance (simple Euclidean for now, PostGIS RPC can be used later)
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      pharmacies = pharmacies
        .map((p) => {
          let distance: number | null = null;
          if (p.location && typeof p.location === 'object') {
            const loc = p.location as { lat?: number; lng?: number };
            if (loc.lat && loc.lng) {
              const dLat = loc.lat - userLat;
              const dLng = loc.lng - userLng;
              distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111; // rough km
            }
          }
          return { ...p, distance_km: distance };
        })
        .sort((a, b) => {
          if (a.distance_km === null) return 1;
          if (b.distance_km === null) return -1;
          return a.distance_km - b.distance_km;
        });
    }

    return NextResponse.json({ pharmacies });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/lab/chains/[code]/branches
 *
 * Returns nearby branches for a lab chain, sorted by distance.
 *
 * Query params:
 *   - lat: latitude (required)
 *   - lng: longitude (required)
 *   - radius_km: search radius in km (default 20)
 *
 * Public endpoint — no authentication required.
 * Calls the find_nearest_chain_branches() Supabase RPC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

export const dynamic = 'force-dynamic';

const VALID_CHAIN_CODES = new Set(['alborg', 'almokhtabar', 'alfa']);

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Validate chain code
    const { code } = await context.params;
    if (!VALID_CHAIN_CODES.has(code)) {
      return NextResponse.json(
        { error: `Invalid chain code: ${code}` },
        { status: 400 }
      );
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    const radiusKm = parseFloat(searchParams.get('radius_km') ?? '20');

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng query parameters are required' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Cap radius to reasonable bounds
    const clampedRadius = Math.min(Math.max(radiusKm, 1), 100);

    // 3. Call Supabase RPC
    const supabase = createServerClient();

    const { data: branches, error } = await supabase.rpc('find_nearest_chain_branches', {
      p_chain_code: code,
      p_lat: lat,
      p_lng: lng,
      p_radius_km: clampedRadius,
    });

    if (error) {
      console.error('[chain-branches] RPC error:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch branches' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      branches: (branches ?? []).map((b: Record<string, unknown>) => ({
        branchId: b.branch_id,
        nameAr: b.name_ar,
        nameEn: b.name_en,
        addressAr: b.address_ar,
        phone: b.phone,
        distanceKm: typeof b.distance_km === 'number'
          ? Math.round(b.distance_km * 10) / 10
          : null,
        openingTime: b.opening_time,
        closingTime: b.closing_time,
        homeCollection: b.home_collection,
      })),
      chainCode: code,
    });
  } catch (err) {
    console.error('[chain-branches] unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

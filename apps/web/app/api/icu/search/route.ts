/**
 * ICU Bed Search API
 *
 * GET /api/icu/search?lat=X&lng=Y&unit_type=general_icu&radius_km=50
 * Searches nearby ICU beds using PostGIS RPC.
 * Auth: verified doctor account required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { IcuSearchResult, IcuUnitType } from '@triaji/shared/types/icu';

export const dynamic = 'force-dynamic';

const VALID_UNIT_TYPES: IcuUnitType[] = [
  'general_icu',
  'cardiac_icu',
  'neonatal_icu',
  'paediatric_icu',
  'surgical_icu',
  'neurological_icu',
  'burns_icu',
  'respiratory_icu',
];

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return request.cookies.get('sb-access-token')?.value || null;
}

export async function GET(request: NextRequest) {
  try {
    // ── Auth: verify doctor ──────────────────────────────────────────────
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: doctorAccount, error: doctorError } = await supabase
      .from('doctor_accounts')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (doctorError || !doctorAccount) {
      return NextResponse.json({ error: 'Doctor account required' }, { status: 403 });
    }

    // ── Parse query params ───────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const radiusKm = parseFloat(searchParams.get('radius_km') || '50');
    const unitType = searchParams.get('unit_type') || null;

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng are required numeric parameters' },
        { status: 400 }
      );
    }

    if (unitType && !VALID_UNIT_TYPES.includes(unitType as IcuUnitType)) {
      return NextResponse.json(
        { error: `Invalid unit_type. Valid: ${VALID_UNIT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // ── Call PostGIS RPC ─────────────────────────────────────────────────
    const rpcParams: Record<string, unknown> = {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
    };

    if (unitType) {
      rpcParams.p_unit_type = unitType;
    }

    const { data, error: rpcError } = await supabase.rpc('find_icu_beds_near', rpcParams);

    if (rpcError) {
      console.error('[ICU Search] RPC error:', rpcError);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    const results: IcuSearchResult[] = (data as IcuSearchResult[]) ?? [];

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[ICU Search] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/lab/chains/[code]/slots
 *
 * Returns available appointment slots for a lab chain.
 * Query params:
 *   - test_codes: comma-separated test codes
 *   - lat: latitude
 *   - lng: longitude
 *   - preferred_date: ISO date string (YYYY-MM-DD)
 *
 * If chain API is available: returns real-time slots with branch info + distance.
 * If chain API is not available: returns { apiAvailable: false } so client shows generic picker.
 *
 * Auth: patient (via cookie or Authorization header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getLabChainAdapter,
  isChainApiAvailable,
  type LabChainCode,
} from '@triaji/lab-chain-adapters';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticatePatient(request: NextRequest): Promise<string | null> {
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;
  return user.id;
}

const VALID_CHAIN_CODES = new Set<string>(['alborg', 'almokhtabar', 'alfa']);

// ─── GET ────────────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authenticate patient
    const userId = await authenticatePatient(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Validate chain code
    const { code } = await context.params;
    if (!VALID_CHAIN_CODES.has(code)) {
      return NextResponse.json(
        { error: `Invalid chain code: ${code}` },
        { status: 400 }
      );
    }

    const chainCode = code as LabChainCode;

    // 3. Check if chain API is available
    if (!isChainApiAvailable(chainCode)) {
      return NextResponse.json({ apiAvailable: false });
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url);
    const testCodesRaw = searchParams.get('test_codes') ?? '';
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    const preferredDate = searchParams.get('preferred_date') ?? undefined;

    const testCodes = testCodesRaw
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (testCodes.length === 0) {
      return NextResponse.json(
        { error: 'test_codes query parameter is required' },
        { status: 400 }
      );
    }

    // 5. Call adapter
    const adapter = getLabChainAdapter(chainCode);
    const slots = await adapter.getAvailableSlots({
      testCodes,
      latitude: isNaN(lat) ? undefined : lat,
      longitude: isNaN(lng) ? undefined : lng,
      date: preferredDate,
    });

    // 6. Enrich slots with distance if lat/lng provided
    const enrichedSlots = slots.map((slot) => ({
      ...slot,
      // Distance computed client-side if branch has coords
    }));

    return NextResponse.json({
      apiAvailable: true,
      slots: enrichedSlots,
      chainCode,
    });
  } catch (err) {
    console.error('[lab-chain-slots] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch available slots' },
      { status: 500 }
    );
  }
}

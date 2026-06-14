/**
 * POST /api/admin/chains/[code]/import-tests
 *
 * Bulk import test code mappings from JSON body.
 * Body: array of test mapping objects.
 * Upserts to lab_chain_test_mapping.
 *
 * Auth: platform_admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const VALID_CHAIN_CODES = new Set(['alborg', 'almokhtabar', 'alfa']);

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface TestMappingImport {
  triaji_code: string;
  chain_test_code: string;
  chain_test_name_ar?: string;
  chain_price_egp?: number;
}

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  // Auth
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required' },
      { status: 403 }
    );
  }

  try {
    const { code } = await context.params;

    if (!VALID_CHAIN_CODES.has(code)) {
      return NextResponse.json(
        { error: `Invalid chain code: ${code}` },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Accept array at top level or { tests: [...] }
    const tests: TestMappingImport[] = Array.isArray(body) ? body : (body.tests ?? []);

    if (tests.length === 0) {
      return NextResponse.json(
        { error: 'No test mappings provided. Expected an array of test mapping objects.' },
        { status: 400 }
      );
    }

    // Validate required fields
    for (let i = 0; i < tests.length; i++) {
      const tm = tests[i]!;
      if (!tm.triaji_code || !tm.chain_test_code) {
        return NextResponse.json(
          { error: `Test mapping at index ${i} is missing required fields (triaji_code, chain_test_code)` },
          { status: 400 }
        );
      }
    }

    const supabase = getServiceClient();

    // Build records for upsert
    const records = tests.map((tm) => ({
      chain_code: code,
      triaji_code: tm.triaji_code,
      chain_test_code: tm.chain_test_code,
      chain_test_name_ar: tm.chain_test_name_ar ?? null,
      chain_price_egp: tm.chain_price_egp ?? null,
      is_available: true,
    }));

    // Upsert on (chain_code, triaji_code) unique constraint
    const { data: upserted, error } = await supabase
      .from('lab_chain_test_mapping')
      .upsert(records, {
        onConflict: 'chain_code,triaji_code',
        ignoreDuplicates: false,
      })
      .select('id, triaji_code, chain_test_code, chain_test_name_ar, chain_price_egp');

    if (error) {
      return NextResponse.json(
        { error: `Import failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Get total count
    const { count: totalMappings } = await supabase
      .from('lab_chain_test_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('chain_code', code)
      .eq('is_available', true);

    return NextResponse.json({
      imported: (upserted ?? []).length,
      totalMappings: totalMappings ?? 0,
      mappings: upserted ?? [],
    });
  } catch (err) {
    console.error('[import-tests] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

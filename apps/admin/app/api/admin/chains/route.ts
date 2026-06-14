/**
 * GET /api/admin/chains
 * List all lab chains with stats (orders this month, branch count, test mappings count).
 * Auth: platform_admin
 *
 * PUT /api/admin/chains
 * Update chain config (has_api, api_contract_signed, payment_via_triaji).
 * Auth: platform_admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
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
    const supabase = getServiceClient();

    // Fetch all chains
    const { data: chains, error } = await supabase
      .from('lab_chains')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch stats for each chain
    const enrichedChains = await Promise.all(
      (chains ?? []).map(async (chain) => {
        // Branch count
        const { count: branchCount } = await supabase
          .from('lab_chain_branches')
          .select('*', { count: 'exact', head: true })
          .eq('chain_code', chain.code)
          .eq('is_active', true);

        // Test mappings count
        const { count: testMappingCount } = await supabase
          .from('lab_chain_test_mapping')
          .select('*', { count: 'exact', head: true })
          .eq('chain_code', chain.code)
          .eq('is_available', true);

        // Orders this month
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { count: ordersThisMonth } = await supabase
          .from('lab_order_routing')
          .select('*', { count: 'exact', head: true })
          .eq('chain_code', chain.code)
          .gte('routed_at', monthStart.toISOString());

        return {
          ...chain,
          stats: {
            branchCount: branchCount ?? 0,
            testMappingCount: testMappingCount ?? 0,
            ordersThisMonth: ordersThisMonth ?? 0,
          },
        };
      })
    );

    return NextResponse.json({ chains: enrichedChains });
  } catch (err) {
    console.error('[admin-chains] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────

interface UpdateChainBody {
  code: string;
  has_api?: boolean;
  api_contract_signed?: boolean;
  payment_via_triaji?: boolean;
  api_live_date?: string | null;
}

export async function PUT(request: NextRequest) {
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
    const body = (await request.json()) as UpdateChainBody;

    if (!body.code) {
      return NextResponse.json(
        { error: 'chain code is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (body.has_api !== undefined) updates.has_api = body.has_api;
    if (body.api_contract_signed !== undefined) updates.api_contract_signed = body.api_contract_signed;
    if (body.payment_via_triaji !== undefined) updates.payment_via_triaji = body.payment_via_triaji;
    if (body.api_live_date !== undefined) updates.api_live_date = body.api_live_date;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('lab_chains')
      .update(updates)
      .eq('code', body.code)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chain: updated });
  } catch (err) {
    console.error('[admin-chains] PUT error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

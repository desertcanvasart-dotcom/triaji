/**
 * GET /api/admin/chain/price
 *
 * Resolves chain pricing for a given tenant + service type.
 * Used by InvoiceForm to pre-fill prices.
 *
 * Query params:
 *   tenant_id: string
 *   service_type: string (consultation, lab_test, procedure, medication)
 *   service_code?: string
 *
 * Price resolution priority (amendment):
 * 1. Branch exception in chain_pricing
 * 2. Chain-level price in chain_pricing
 * 3. null → caller uses branch fallback
 * 4. Manual override at invoice level (always allowed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';

interface ChainPricingException {
  branch_id: string;
  price_egp: number;
  urgent_price_egp?: number;
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = request.nextUrl;
  const tenantId = searchParams.get('tenant_id');
  const serviceType = searchParams.get('service_type');
  const serviceCode = searchParams.get('service_code') ?? undefined;

  if (!tenantId || !serviceType) {
    return NextResponse.json(
      { error: 'tenant_id and service_type are required' },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    // Step 1: Check if tenant belongs to a chain with shared_pricing
    const { data: branch } = await supabase
      .from('chain_branches')
      .select('chain_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!branch) return NextResponse.json(null);

    const chainId = branch.chain_id as string;

    const { data: chain } = await supabase
      .from('chains')
      .select('shared_pricing')
      .eq('id', chainId)
      .eq('is_active', true)
      .single();

    if (!chain || !(chain.shared_pricing as boolean)) return NextResponse.json(null);

    // Step 2: Load chain_pricing for this service_type + service_code
    let query = supabase
      .from('chain_pricing')
      .select('*')
      .eq('chain_id', chainId)
      .eq('service_type', serviceType)
      .eq('is_active', true);

    if (serviceCode) {
      query = query.eq('service_code', serviceCode);
    }

    const { data: pricingRows } = await query.order('sort_order', { ascending: true }).limit(1);

    if (!pricingRows || pricingRows.length === 0) return NextResponse.json(null);

    const pricing = pricingRows[0];
    const branchExceptions = (pricing.branch_exceptions as ChainPricingException[]) ?? [];

    // Step 3: Check branch_exceptions for this tenant
    const branchException = branchExceptions.find((ex) => ex.branch_id === tenantId);

    if (branchException) {
      return NextResponse.json({
        price_egp: branchException.price_egp,
        urgent_price_egp: branchException.urgent_price_egp ?? null,
        source: 'branch_exception',
        chain_pricing_id: pricing.id,
      });
    }

    // Step 4: Return chain price
    return NextResponse.json({
      price_egp: pricing.price_egp,
      urgent_price_egp: pricing.urgent_price_egp ?? null,
      source: 'chain_price',
      chain_pricing_id: pricing.id,
    });
  } catch (err) {
    console.error('[chain/price] Error resolving price:', err);
    return NextResponse.json(null);
  }
}

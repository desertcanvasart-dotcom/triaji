/**
 * Chain Price Resolver
 *
 * Resolves prices using the 4-tier priority (AMENDMENT):
 * 1. Branch exception in chain_pricing
 * 2. Chain-level price in chain_pricing
 * 3. Branch-level fallback price (tenant's own pricing) — returned as null, caller handles
 * 4. Manual staff override — always allowed at invoice level
 */

import { createServerClient } from '@triaji/shared/supabase';
import type { ResolvedPrice, ChainPricingException } from '@triaji/shared/types/chain';

// ─── resolveChainPrice ───────────────────────────────────────────────────────
//
// Returns a ResolvedPrice or null.
// If null, the caller should use the branch's own pricing (source='branch_fallback').
// Manual override is always allowed at the invoice level (source='manual').

export async function resolveChainPrice(
  tenantId: string,
  serviceType: string,
  serviceCode?: string
): Promise<ResolvedPrice | null> {
  const supabase = createServerClient();

  // Step 1: Check if tenant has a chain with shared_pricing=true.
  // Branches are tenants rows; the chain link is tenants.chain_id.
  const { data: branch } = await supabase
    .from('tenants')
    .select('chain_id')
    .eq('id', tenantId)
    .eq('is_active', true)
    .single();

  if (!branch?.chain_id) return null;

  const chainId = branch.chain_id as string;

  const { data: chain } = await supabase
    .from('chains')
    .select('shared_pricing')
    .eq('id', chainId)
    .eq('is_active', true)
    .single();

  if (!chain || !(chain.shared_pricing as boolean)) return null;

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

  if (!pricingRows || pricingRows.length === 0) {
    // No chain pricing found — caller uses branch fallback
    return null;
  }

  const pricing = pricingRows[0];
  const pricingId = pricing.id as string;
  const chainPriceEgp = pricing.price_egp as number;
  const chainUrgentPriceEgp = (pricing.urgent_price_egp as number) ?? null;
  const branchExceptions = (pricing.branch_exceptions as ChainPricingException[]) ?? [];

  // Step 3: Check branch_exceptions for this specific branch (tenantId)
  const branchException = branchExceptions.find(
    (ex) => ex.branch_id === tenantId
  );

  if (branchException) {
    // Priority 1: Branch exception price
    return {
      price_egp: branchException.price_egp,
      urgent_price_egp: branchException.urgent_price_egp ?? null,
      source: 'branch_exception',
      chain_pricing_id: pricingId,
    };
  }

  // Priority 2: Chain price
  return {
    price_egp: chainPriceEgp,
    urgent_price_egp: chainUrgentPriceEgp,
    source: 'chain_price',
    chain_pricing_id: pricingId,
  };
}

// ─── resolveChainPriceBatch ──────────────────────────────────────────────────
//
// Resolve multiple service prices at once for a tenant.
// Used by invoice forms to pre-fill all line items.

export async function resolveChainPriceBatch(
  tenantId: string,
  services: { serviceType: string; serviceCode?: string }[]
): Promise<Map<string, ResolvedPrice>> {
  const results = new Map<string, ResolvedPrice>();

  for (const svc of services) {
    const key = svc.serviceCode
      ? `${svc.serviceType}:${svc.serviceCode}`
      : svc.serviceType;
    const resolved = await resolveChainPrice(tenantId, svc.serviceType, svc.serviceCode);
    if (resolved) {
      results.set(key, resolved);
    }
  }

  return results;
}

/**
 * Chain Patient Recognition
 *
 * Manages the chain_patient_registry — tracking patients across branches.
 * AMENDMENT: upsertChainPatient is called ONLY when booking status becomes 'confirmed'.
 */

import { createServerClient } from '@triaji/shared/supabase';
import type { ChainPatientRegistry } from '@triaji/shared/types/chain';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChainPatientInfo {
  chainId: string;
  chainNameAr: string;
  chainNameEn: string | null;
  firstSeenAt: string;
  firstBranchId: string;
  firstBranchNameAr: string;
  totalVisits: number;
  lastVisitBranchId: string | null;
  lastVisitAt: string | null;
  branchesVisited: {
    branchId: string;
    branchNameAr: string;
    branchNameEn: string | null;
    visitCount: number;
  }[];
}

export interface ChainInfo {
  chainId: string;
  chainNameAr: string;
  chainNameEn: string | null;
  sharedPricing: boolean;
  sharedPatientRecords: boolean;
}

// ─── upsertChainPatient ──────────────────────────────────────────────────────
//
// Called ONLY when booking.status transitions to 'confirmed'.
// If new patient → insert into chain_patient_registry.
// If existing → increment total_visits, update last_visit_branch_id + last_visit_at.

export async function upsertChainPatient(
  chainId: string,
  patientId: string,
  branchId: string
): Promise<void> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  // Check if patient already exists in chain registry
  const { data: existing } = await supabase
    .from('chain_patient_registry')
    .select('id, total_visits')
    .eq('chain_id', chainId)
    .eq('patient_id', patientId)
    .single();

  if (existing) {
    // Existing patient — increment visits, update last visit
    await supabase
      .from('chain_patient_registry')
      .update({
        total_visits: (existing.total_visits as number) + 1,
        last_visit_branch_id: branchId,
        last_visit_at: now,
      })
      .eq('id', existing.id);
  } else {
    // New patient — insert
    await supabase.from('chain_patient_registry').insert({
      chain_id: chainId,
      patient_id: patientId,
      first_seen_at: now,
      first_branch_id: branchId,
      total_visits: 1,
      last_visit_branch_id: branchId,
      last_visit_at: now,
    });
  }
}

// ─── getChainPatientInfo ─────────────────────────────────────────────────────
//
// Returns chain membership info for a patient. Returns null if patient is not
// in the chain registry. Does NOT expose financial data from other branches.

export async function getChainPatientInfo(
  chainId: string,
  patientId: string
): Promise<ChainPatientInfo | null> {
  const supabase = createServerClient();

  // Get chain info
  const { data: chain } = await supabase
    .from('chains')
    .select('id, name_ar, name_en')
    .eq('id', chainId)
    .single();

  if (!chain) return null;

  // Get patient registry entry
  const { data: registry } = await supabase
    .from('chain_patient_registry')
    .select('*')
    .eq('chain_id', chainId)
    .eq('patient_id', patientId)
    .single();

  if (!registry) return null;

  const reg = registry as ChainPatientRegistry;

  // Get first branch name
  const { data: firstBranch } = await supabase
    .from('tenants')
    .select('name_ar')
    .eq('id', reg.first_branch_id)
    .single();

  // Get cross-branch visit summary from bookings
  // Count confirmed bookings per branch within this chain
  const { data: branchVisits } = await supabase
    .from('bookings')
    .select('tenant_id, tenants!inner(name_ar, name_en)')
    .eq('patient_id', patientId)
    .eq('status', 'confirmed')
    .in(
      'tenant_id',
      // Get all branch tenant_ids for this chain (branches are tenants rows)
      (
        await supabase
          .from('tenants')
          .select('id')
          .eq('chain_id', chainId)
      ).data?.map((b) => b.id as string) ?? []
    );

  // Aggregate visits per branch
  const branchMap = new Map<
    string,
    { branchId: string; branchNameAr: string; branchNameEn: string | null; visitCount: number }
  >();

  if (branchVisits) {
    for (const visit of branchVisits) {
      const tid = visit.tenant_id as string;
      const tenant = visit.tenants as unknown as { name_ar: string; name_en: string | null } | null;
      const existing = branchMap.get(tid);
      if (existing) {
        existing.visitCount++;
      } else {
        branchMap.set(tid, {
          branchId: tid,
          branchNameAr: (tenant?.name_ar as string) ?? '',
          branchNameEn: (tenant?.name_en as string) ?? null,
          visitCount: 1,
        });
      }
    }
  }

  return {
    chainId: chain.id as string,
    chainNameAr: chain.name_ar as string,
    chainNameEn: (chain.name_en as string) ?? null,
    firstSeenAt: reg.first_seen_at,
    firstBranchId: reg.first_branch_id,
    firstBranchNameAr: (firstBranch?.name_ar as string) ?? '',
    totalVisits: reg.total_visits,
    lastVisitBranchId: reg.last_visit_branch_id,
    lastVisitAt: reg.last_visit_at,
    branchesVisited: Array.from(branchMap.values()),
  };
}

// ─── getChainForTenant ───────────────────────────────────────────────────────
//
// Check if a tenant belongs to a chain. Returns chain info or null.

export async function getChainForTenant(
  tenantId: string
): Promise<ChainInfo | null> {
  const supabase = createServerClient();

  const { data: branch } = await supabase
    .from('tenants')
    .select('chain_id')
    .eq('id', tenantId)
    .eq('is_active', true)
    .single();

  if (!branch?.chain_id) return null;

  const { data: chain } = await supabase
    .from('chains')
    .select('id, name_ar, name_en, shared_pricing, shared_patient_records')
    .eq('id', branch.chain_id)
    .eq('is_active', true)
    .single();

  if (!chain) return null;

  return {
    chainId: chain.id as string,
    chainNameAr: chain.name_ar as string,
    chainNameEn: (chain.name_en as string) ?? null,
    sharedPricing: chain.shared_pricing as boolean,
    sharedPatientRecords: chain.shared_patient_records as boolean,
  };
}

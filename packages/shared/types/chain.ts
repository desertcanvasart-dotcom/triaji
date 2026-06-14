// ─── Chain Types ─────────────────────────────────────────────────────────────

export type ChainType = 'clinic_chain' | 'lab_chain' | 'radiology_chain' | 'pharmacy_chain' | 'mixed';

export interface Chain {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string | null;
  chain_type: ChainType;
  logo_url: string | null;
  owner_account_id: string;
  main_phone: string | null;
  main_email: string | null;
  website: string | null;
  shared_pricing: boolean;
  shared_patient_records: boolean;
  primary_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChainPricing {
  id: string;
  chain_id: string;
  service_type: string;
  service_code: string | null;
  service_name_ar: string;
  service_name_en: string | null;
  price_egp: number;
  urgent_price_egp: number | null;
  applies_to_all_branches: boolean;
  branch_exceptions: ChainPricingException[];
  is_active: boolean;
  effective_from: string;
  sort_order: number;
  created_at: string;
}

export interface ChainPricingException {
  branch_id: string;
  price_egp: number;
  urgent_price_egp?: number;
}

export interface ChainPatientRegistry {
  id: string;
  chain_id: string;
  patient_id: string;
  first_seen_at: string;
  first_branch_id: string;
  total_visits: number;
  last_visit_branch_id: string | null;
  last_visit_at: string | null;
}

export interface DoctorBranchAssignment {
  id: string;
  chain_id: string;
  doctor_id: string;
  branch_ids: string[];
  schedule: Record<string, { days: number[]; slots?: string[] }>;
  is_active: boolean;
  created_at: string;
}

/**
 * Price resolution priority (amendment 3):
 * 1. Branch exception in chain_pricing
 * 2. Chain-level price in chain_pricing
 * 3. Branch-level fallback price (tenant's own pricing)
 * 4. Manual staff override (always allowed)
 */
export interface ResolvedPrice {
  price_egp: number;
  urgent_price_egp: number | null;
  source: 'branch_exception' | 'chain_price' | 'branch_fallback' | 'manual';
  chain_pricing_id?: string;
}

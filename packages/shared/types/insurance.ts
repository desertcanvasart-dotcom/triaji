import type { PolicyStatus, PreauthStatus, ClaimStatus, ClaimType } from './enums';

// ─── Insurance Companies ────────────────────────────────────────────────────

export interface InsuranceCompany {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  hotline: string | null;
  website: string | null;
  has_api: boolean;
  api_adapter_key: string | null;
  tenant_id: string | null;
  is_active: boolean;
  sort_order: number;
}

// ─── Patient Insurance Policies ─────────────────────────────────────────────

export interface PatientInsurancePolicy {
  id: string;
  patient_id: string;
  insurer_code: string;
  insurer_tenant_id: string | null;
  policy_number: string;
  card_number: string | null;
  member_name_ar: string | null;
  employer_ar: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  annual_limit_egp: number | null;
  used_limit_egp: number;
  remaining_limit_egp: number | null;
  copay_pct: number;
  status: PolicyStatus;
  last_verified_at: string | null;
  verified_by: string | null;
  card_image_url: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Pre-Authorization Requests ─────────────────────────────────────────────

export interface PreAuthRequest {
  id: string;
  patient_id: string;
  policy_id: string;
  insurer_tenant_id: string | null;
  insurer_code: string;
  requesting_tenant_id: string;
  requesting_doctor_id: string | null;
  procedure_type: string;
  procedure_description_ar: string;
  procedure_description_en: string | null;
  icd10_code: string | null;
  estimated_cost_egp: number | null;
  clinical_justification_ar: string;
  clinical_justification_en: string | null;
  urgency: string;
  health_record_id: string | null;
  referral_id: string | null;
  status: PreauthStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_amount_egp: number | null;
  approval_conditions_ar: string | null;
  denial_reason_ar: string | null;
  denial_code: string | null;
  preauth_reference: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Insurance Claims ───────────────────────────────────────────────────────

export interface InsuranceClaim {
  id: string;
  claim_number: string;
  claim_type: ClaimType;
  patient_id: string;
  policy_id: string;
  insurer_code: string;
  insurer_tenant_id: string | null;
  provider_tenant_id: string;
  provider_type: string;
  treating_doctor_id: string | null;
  total_amount_egp: number;
  claimed_amount_egp: number;
  approved_amount_egp: number | null;
  patient_copay_egp: number | null;
  provider_receives_egp: number | null;
  line_items: ClaimLineItem[];
  status: ClaimStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason_ar: string | null;
  rejection_code: string | null;
  preauth_id: string | null;
  remittance_id: string | null;
  paid_at: string | null;
  submission_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimLineItem {
  description_ar: string;
  icd10Code?: string;
  quantity: number;
  unitPrice: number;
  claimedAmount: number;
  approvedAmount?: number;
}

// ─── Remittance Records ─────────────────────────────────────────────────────

export interface RemittanceRecord {
  id: string;
  insurer_tenant_id: string;
  provider_tenant_id: string;
  insurer_code: string;
  remittance_number: string;
  period_start: string;
  period_end: string;
  total_claims: number;
  total_amount_egp: number;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
}

// ─── ICU Enums ──────────────────────────────────────────────────────────────

export type IcuUnitType =
  | 'general_icu'
  | 'cardiac_icu'
  | 'neonatal_icu'
  | 'paediatric_icu'
  | 'surgical_icu'
  | 'neurological_icu'
  | 'burns_icu'
  | 'respiratory_icu';

export type IcuUpdateSource = 'manual' | 'his_sync';

export type TransferStatus =
  | 'requested'
  | 'acknowledged'
  | 'accepted'
  | 'declined'
  | 'en_route'
  | 'arrived'
  | 'cancelled';

// ─── ICU Units ──────────────────────────────────────────────────────────────

export interface IcuUnit {
  id: string;
  tenant_id: string;
  unit_type: IcuUnitType;
  unit_name_ar: string;
  unit_name_en: string | null;
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  floor_ar: string | null;
  floor_en: string | null;
  phone_direct: string | null;
  accepts_transfers: boolean;
  his_unit_id: string | null;
  last_his_sync_at: string | null;
  update_source: IcuUpdateSource;
  is_active: boolean;
  closure_reason_ar: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Availability Log ───────────────────────────────────────────────────────

export interface IcuAvailabilityLogEntry {
  id: string;
  icu_unit_id: string;
  tenant_id: string;
  previous_available: number;
  new_available: number;
  change_reason: string | null;
  updated_by: string | null;
  transfer_request_id: string | null;
  created_at: string;
}

// ─── Transfer Requests ──────────────────────────────────────────────────────

export interface IcuTransferRequest {
  id: string;
  requesting_doctor_id: string;
  requesting_account_id: string;
  requesting_tenant_id: string | null;
  receiving_tenant_id: string;
  icu_unit_id: string;
  patient_id: string | null;
  patient_name_ar: string;
  patient_age: number | null;
  patient_sex: string | null;
  patient_phone: string | null;
  diagnosis_ar: string;
  clinical_summary_ar: string;
  urgency: 'urgent' | 'emergency';
  current_location_ar: string;
  current_location_lat: number | null;
  current_location_lng: number | null;
  estimated_eta_minutes: number | null;
  status: TransferStatus;
  requested_at: string;
  acknowledged_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason_ar: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  cancelled_at: string | null;
  accepted_by: string | null;
  bed_assigned_ar: string | null;
  receiving_contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Search Result (from RPC) ───────────────────────────────────────────────

export interface IcuSearchResult {
  icu_unit_id: string;
  tenant_id: string;
  hospital_name_ar: string;
  hospital_name_en: string;
  unit_type: IcuUnitType;
  unit_name_ar: string;
  unit_name_en: string | null;
  available_beds: number;
  total_beds: number;
  floor_ar: string | null;
  phone_direct: string | null;
  accepts_transfers: boolean;
  distance_km: number;
  last_updated_at: string;
}

// ─── HIS ICU Availability ───────────────────────────────────────────────────

export interface HisIcuAvailability {
  hisUnitId: string;
  unitType: IcuUnitType;
  totalBeds: number;
  availableBeds: number;
  lastUpdatedAt: Date;
}

// ─── Staleness levels for trust indicators ──────────────────────────────────

export type StalenessLevel = 'fresh' | 'stale' | 'unreliable';

export function getStalenessLevel(updatedAt: string): StalenessLevel {
  const hoursAgo = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 2) return 'fresh';
  if (hoursAgo < 6) return 'stale';
  return 'unreliable';
}

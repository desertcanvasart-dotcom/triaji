import type { LabOrderStatus, LabAppointmentStatus } from './enums';

// ─── Lab Service Catalog ────────────────────────────────────────────────────

export interface LabService {
  id: string;
  tenant_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  category_ar: string;
  service_type: 'lab_test' | 'radiology';
  price_egp: number;
  urgent_price_egp: number | null;
  fasting_required: boolean;
  fasting_hours: number | null;
  sample_type_ar: string | null;
  preparation_ar: string | null;
  modality: string | null;
  contrast_available: boolean;
  duration_minutes: number | null;
  requires_appointment: boolean;
  available_slots_per_day: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface LabTestCatalog {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  category_ar: string;
  service_type: string;
  modality: string | null;
  fasting_required: boolean;
  sample_type_ar: string | null;
  sort_order: number;
}

// ─── Lab Order Routing ──────────────────────────────────────────────────────

export interface LabOrderRouting {
  id: string;
  health_record_id: string;
  lab_tenant_id: string;
  doctor_id: string;
  doctor_account_id: string | null;
  patient_id: string;

  is_urgent: boolean;
  status: LabOrderStatus;

  routed_at: string | null;
  received_at: string | null;
  sample_collected_at: string | null;
  results_ready_at: string | null;
  delivered_at: string | null;

  lab_appointment_id: string | null;
  result_health_record_id: string | null;

  routing_note_ar: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Lab Appointments ───────────────────────────────────────────────────────

export interface LabAppointment {
  id: string;
  lab_tenant_id: string;
  patient_id: string | null;
  patient_name_ar: string;
  patient_phone: string | null;
  lab_order_routing_id: string | null;

  appointment_datetime: string | null;
  is_walk_in: boolean;
  is_home_collection: boolean;
  collection_address_ar: string | null;

  status: LabAppointmentStatus;
  checked_in_at: string | null;
  completed_at: string | null;

  notes_ar: string | null;
  created_at: string;
}

// ─── Lab Result Value ───────────────────────────────────────────────────────

export interface LabResultValue {
  test_code: string;
  test_name_ar: string;
  test_name_en: string;
  value: string;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  reference_range_text: string;
  is_abnormal: boolean;
}

// ─── Lab Result Upload Payload ──────────────────────────────────────────────

export interface LabResultUpload {
  routingId: string;
  resultType: 'lab_test' | 'radiology';
  labValues?: LabResultValue[];
  reportAr?: string;
  reportEn?: string;
  fileUrl?: string;
  radiologistOpinion?: 'normal' | 'abnormal' | 'needs_followup';
  technicianNotes?: string;
}

import type { UrgencyLevel } from './enums';

// ─── Specialty ───────────────────────────────────────────────────────────────

export interface Specialty {
  id: string;
  name_ar: string;
  name_en: string;
  parent_specialty_id: string | null;
  urgency_default: UrgencyLevel;
  icon_code: string;
  is_active: boolean;
  sort_order: number;
}

// ─── Doctor ──────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  tenant_id: string;
  name_ar: string;
  name_en: string | null;
  title_ar: string;
  specialty_id: string;
  sub_specialty_ids: string[];
  bio_ar: string | null;
  photo_url: string | null;
  languages: string[];
  governorate_id: string;
  clinic_address_ar: string;
  location: {
    lat: number;
    lng: number;
  } | null;
  consultation_fee_egp: number;
  accepts_insurance: boolean;
  insurance_providers: string[];
  accepting_new_patients: boolean;
  available_for_booking: boolean;
  rating_avg: number;
  rating_count: number;
  his_doctor_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Doctor Availability ─────────────────────────────────────────────────────

export interface DoctorAvailability {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

// ─── Doctor Rating ───────────────────────────────────────────────────────────

export interface DoctorRating {
  id: string;
  doctor_id: string;
  patient_id: string;
  session_id: string | null;
  rating: number;
  comment_ar: string | null;
  created_at: string;
}

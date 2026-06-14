// ─── Paediatric Types ────────────────────────────────────────────────────────

export type GuardianRelation =
  | 'mother' | 'father' | 'grandmother' | 'grandfather'
  | 'sibling' | 'legal_guardian' | 'other';

export interface GuardianRelationship {
  id: string;
  guardian_patient_id: string;
  child_patient_id: string;
  relation: GuardianRelation;
  is_primary_guardian: boolean;
  can_book: boolean;
  can_view_records: boolean;
  created_at: string;
}

export interface GrowthMeasurement {
  id: string;
  patient_id: string;
  measured_at: string;
  age_months: number;
  weight_kg: number | null;
  height_cm: number | null;
  head_circ_cm: number | null;
  bmi: number | null;
  weight_percentile: number | null;
  height_percentile: number | null;
  bmi_percentile: number | null;
  head_circ_percentile: number | null;
  source: string;
  measured_by_doctor: string | null;
  notes_ar: string | null;
  created_at: string;
}

export interface WhoGrowthReference {
  sex: string;
  age_months: number;
  measure: string;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

export type VaccineStatus = 'due' | 'overdue' | 'given' | 'skipped' | 'deferred';

export interface VaccineCatalog {
  code: string;
  name_ar: string;
  name_en: string;
  disease_ar: string;
  disease_en: string;
  doses_required: number;
  schedule_months: number[];
  is_mandatory: boolean;
  egypt_moh_code: string | null;
  notes_ar: string | null;
  sort_order: number;
}

export interface VaccinationScheduleEntry {
  id: string;
  patient_id: string;
  vaccine_code: string;
  dose_number: number;
  scheduled_age_months: number;
  due_date: string | null;
  status: VaccineStatus;
  given_date: string | null;
  given_by_doctor: string | null;
  given_at_facility: string | null;
  batch_number: string | null;
  next_dose_due: string | null;
  skip_reason_ar: string | null;
  defer_reason_ar: string | null;
  notes_ar: string | null;
  reminder_sent: boolean;
  created_at: string;
  // Joined
  vaccine?: VaccineCatalog;
}

export type MilestoneCategory = 'gross_motor' | 'fine_motor' | 'language' | 'social' | 'cognitive';

export interface MilestoneCatalog {
  id: string;
  category: MilestoneCategory;
  category_ar: string;
  age_months: number;
  milestone_ar: string;
  milestone_en: string;
  is_red_flag: boolean;
  sort_order: number;
}

export interface PatientMilestone {
  id: string;
  patient_id: string;
  milestone_id: string;
  achieved: boolean | null;
  achieved_at_months: number | null;
  notes_ar: string | null;
  assessed_by: string;
  assessed_at: string;
  // Joined
  milestone?: MilestoneCatalog;
}

export interface SchoolHealthRecord {
  id: string;
  patient_id: string;
  academic_year: string;
  school_name_ar: string;
  school_grade_ar: string;
  exam_date: string | null;
  examining_doctor: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  vision_right: string | null;
  vision_left: string | null;
  hearing_normal: boolean | null;
  dental_notes_ar: string | null;
  general_notes_ar: string | null;
  fit_for_school: boolean;
  restriction_ar: string | null;
  certificate_issued: boolean;
  certificate_pdf_url: string | null;
  created_at: string;
}

export interface PaediatricDrugFormulation {
  form: string;
  concentration: string;
  unit: string;
  notes_ar?: string;
}

export interface PaediatricDrugDosing {
  id: string;
  drug_name_en: string;
  drug_name_ar: string;
  indication_ar: string | null;
  dose_mg_per_kg: number | null;
  dose_min_mg_per_kg: number | null;
  dose_max_mg_per_kg: number | null;
  doses_per_day: number | null;
  max_single_dose_mg: number | null;
  max_daily_dose_mg: number | null;
  min_age_months: number;
  max_age_months: number;
  min_weight_kg: number | null;
  max_weight_kg: number | null;
  egyptian_formulations: PaediatricDrugFormulation[];
  notes_ar: string | null;
  is_active: boolean;
}

export interface ChildProfile {
  patientId: string;
  name: string;
  dateOfBirth: string;
  ageMonths: number;
  sex: 'male' | 'female';
  relation: GuardianRelation;
  isPaediatric: true;
}

// Paediatric urgency thresholds
export const PAEDIATRIC_URGENCY = {
  FEVER_EMERGENCY_UNDER_3M: 38.0,    // °C in under 3 months = emergency
  FEVER_URGENT_3_36M: 38.5,          // °C in 3–36 months = urgent
  SEIZURE: 'emergency' as const,
  BREATHING_DIFFICULTY: 'emergency' as const,
  RASH_WITH_FEVER: 'urgent' as const,
} as const;

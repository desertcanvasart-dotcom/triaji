import type { AllergyCategory, FamilyRelation } from './enums';

// ─── Option Catalogs ────────────────────────────────────────────────────────

export interface AllergyOption {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  category: AllergyCategory;
  sort_order: number;
}

export interface ChronicConditionOption {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  specialty_hint: string | null;
  sort_order: number;
}

export interface SurgeryOption {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
}

export interface FamilyHistoryOption {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  brs_impact: number;
  sort_order: number;
}

// ─── Patient Junction Tables ────────────────────────────────────────────────

export interface PatientAllergy {
  id: string;
  patient_profile_id: string;
  allergy_code: string;
  notes_ar: string | null;
  // Joined option
  allergy_options?: AllergyOption;
}

export interface PatientChronicCondition {
  id: string;
  patient_profile_id: string;
  condition_code: string;
  notes_ar: string | null;
  diagnosed_year: number | null;
  // Joined option
  chronic_condition_options?: ChronicConditionOption;
}

export interface PatientMedication {
  id: string;
  patient_profile_id: string;
  drug_name_ar: string;
  drug_name_en: string | null;
  dose: string | null;
  frequency_ar: string | null;
  for_condition_ar: string | null;
  sort_order: number;
  created_at: string;
}

export interface PatientSurgery {
  id: string;
  patient_profile_id: string;
  surgery_code: string;
  year_approximate: number | null;
  notes_ar: string | null;
  // Joined option
  surgery_options?: SurgeryOption;
}

export interface PatientFamilyHistory {
  id: string;
  patient_profile_id: string;
  condition_code: string;
  relation: FamilyRelation;
  notes_ar: string | null;
  // Joined option
  family_history_options?: FamilyHistoryOption;
}

// ─── Structured Profile (full profile with all joined data) ─────────────────

export interface StructuredPatientProfile {
  allergies: PatientAllergy[];
  chronicConditions: PatientChronicCondition[];
  medications: PatientMedication[];
  surgeries: PatientSurgery[];
  familyHistory: PatientFamilyHistory[];
}

// ─── Onboarding Payload ─────────────────────────────────────────────────────

export interface OnboardingPayload {
  // Step 1: Basic Info
  age: number;
  biological_sex: 'male' | 'female';
  governorate_id: string;

  // Step 2: Physical
  height_cm: number | null;
  weight_kg: number | null;

  // Step 3: Work & Lifestyle
  work_type: string | null;
  work_schedule: string | null;
  activity_level: string | null;

  // Step 4: Clinical Baseline
  smoking_status: string;
  cigarettes_per_day: number | null;
  smoking_years: number | null;
  blood_pressure: string;
  bp_on_medication: boolean;
  diabetes_type: string;
  diabetes_control: string;
  diabetes_treatment: string;
  heart_condition: string;
  previous_heart_attack: boolean;
  heart_surgery: boolean;
  kidney_disease: string;
  liver_disease: string;

  // Step 5: Medical History
  allergies: Array<{ code: string; notes_ar?: string }>;
  chronic_conditions: Array<{ code: string; notes_ar?: string; diagnosed_year?: number }>;
  medications: Array<{
    drug_name_ar: string;
    drug_name_en?: string;
    dose?: string;
    frequency_ar?: string;
    for_condition_ar?: string;
  }>;
  surgeries: Array<{ code: string; year_approximate?: number; notes_ar?: string }>;

  // Step 6: Family History
  family_history: Array<{
    condition_code: string;
    relation: string;
    notes_ar?: string;
  }>;

  // Step 7: Reproductive Health (female only)
  pregnancy_status?: string | null;
  previous_pregnancies?: number | null;
  menstrual_regularity?: string | null;
  menopause_status?: string | null;
  last_menstrual_period_approx?: string | null;
}

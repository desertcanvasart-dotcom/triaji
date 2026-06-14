/**
 * Structured Profile Loader
 * Loads patient profile with all structured junction table data.
 */

import { createServerClient } from '@triaji/shared/supabase';
import type { PatientProfile } from '@triaji/shared/types';
import type {
  PatientAllergy,
  PatientChronicCondition,
  PatientMedication,
  PatientSurgery,
  PatientFamilyHistory,
  StructuredPatientProfile,
} from '@triaji/shared/types';

export interface FullPatientProfile {
  base: PatientProfile;
  structured: StructuredPatientProfile;
}

/**
 * Load patient profile with all structured data via Supabase joins.
 * Returns null if no profile exists.
 */
export async function loadFullPatientProfile(
  patientId: string
): Promise<FullPatientProfile | null> {
  const supabase = createServerClient();

  const { data: profile, error } = await supabase
    .from('patient_profiles')
    .select(
      `
      *,
      patient_allergies(id, allergy_code, notes_ar, allergy_options:allergy_options(name_ar, name_en, category)),
      patient_chronic_conditions(id, condition_code, notes_ar, diagnosed_year, chronic_condition_options:chronic_condition_options(name_ar, name_en, specialty_hint)),
      patient_medications(id, drug_name_ar, drug_name_en, dose, frequency_ar, for_condition_ar, sort_order),
      patient_surgeries(id, surgery_code, year_approximate, notes_ar, surgery_options:surgery_options(name_ar, name_en)),
      patient_family_history(id, condition_code, relation, notes_ar, family_history_options:family_history_options(name_ar, name_en, brs_impact))
    `
    )
    .eq('patient_id', patientId)
    .single();

  if (error || !profile) {
    return null;
  }

  const {
    patient_allergies,
    patient_chronic_conditions,
    patient_medications,
    patient_surgeries,
    patient_family_history,
    ...baseProfile
  } = profile;

  return {
    base: baseProfile as PatientProfile,
    structured: {
      allergies: (patient_allergies ?? []) as PatientAllergy[],
      chronicConditions: (patient_chronic_conditions ?? []) as PatientChronicCondition[],
      medications: (patient_medications ?? []) as PatientMedication[],
      surgeries: (patient_surgeries ?? []) as PatientSurgery[],
      familyHistory: (patient_family_history ?? []) as PatientFamilyHistory[],
    },
  };
}

/**
 * Load all option catalogs for the onboarding form.
 */
export async function loadOptionCatalogs() {
  const supabase = createServerClient();

  const [allergies, conditions, surgeries, familyHistory] = await Promise.all([
    supabase
      .from('allergy_options')
      .select('*')
      .order('sort_order'),
    supabase
      .from('chronic_condition_options')
      .select('*')
      .order('sort_order'),
    supabase
      .from('surgery_options')
      .select('*')
      .order('sort_order'),
    supabase
      .from('family_history_options')
      .select('*')
      .order('sort_order'),
  ]);

  return {
    allergyOptions: allergies.data ?? [],
    conditionOptions: conditions.data ?? [],
    surgeryOptions: surgeries.data ?? [],
    familyHistoryOptions: familyHistory.data ?? [],
  };
}

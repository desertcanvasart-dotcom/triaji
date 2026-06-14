/**
 * Vitals Extraction from Lab Results
 *
 * Maps lab test codes to vital types and auto-inserts into vitals_history
 * when lab results contain vitals-relevant values.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Mapping of lab test codes (from health_records.lab_values JSONB) to vital types
const LAB_TO_VITAL_MAP: Record<string, { vitalType: string; unit: string }> = {
  // Blood glucose
  FBG: { vitalType: 'blood_glucose_fasting', unit: 'mg/dL' },
  FBS: { vitalType: 'blood_glucose_fasting', unit: 'mg/dL' },
  'fasting_glucose': { vitalType: 'blood_glucose_fasting', unit: 'mg/dL' },
  RBG: { vitalType: 'blood_glucose_random', unit: 'mg/dL' },
  RBS: { vitalType: 'blood_glucose_random', unit: 'mg/dL' },
  'random_glucose': { vitalType: 'blood_glucose_random', unit: 'mg/dL' },
};

interface LabValue {
  test_code?: string;
  test_name?: string;
  value: number | string;
  unit?: string;
  reference_range?: string;
}

interface ExtractedVital {
  vital_type: string;
  value: number;
  unit: string;
  test_code: string;
}

/**
 * Extracts vitals-relevant values from lab result data.
 * Returns an array of extracted vitals that can be inserted into vitals_history.
 */
export function extractVitalsFromLabValues(labValues: LabValue[]): ExtractedVital[] {
  const extracted: ExtractedVital[] = [];

  for (const lv of labValues) {
    const code = lv.test_code?.toUpperCase() ?? lv.test_name?.toLowerCase().replace(/\s+/g, '_') ?? '';
    const mapping = LAB_TO_VITAL_MAP[code] ?? LAB_TO_VITAL_MAP[lv.test_code ?? ''];

    if (!mapping) continue;

    const numericValue = typeof lv.value === 'string' ? parseFloat(lv.value) : lv.value;
    if (isNaN(numericValue) || numericValue <= 0) continue;

    extracted.push({
      vital_type: mapping.vitalType,
      value: numericValue,
      unit: lv.unit ?? mapping.unit,
      test_code: code,
    });
  }

  return extracted;
}

/**
 * Auto-inserts vitals from lab results into vitals_history.
 * Called when a new lab result is processed or uploaded.
 *
 * @param supabase - Supabase service client
 * @param patientId - Patient UUID
 * @param healthRecordId - The health_record containing the lab result
 * @param labValues - Parsed lab values from health_records.lab_values JSONB
 * @param labDate - Date of the lab result (used as measured_at)
 */
export async function insertVitalsFromLabResult(
  supabase: SupabaseClient,
  patientId: string,
  healthRecordId: string,
  labValues: LabValue[],
  labDate?: string | Date
): Promise<{ inserted: number; errors: string[] }> {
  const extracted = extractVitalsFromLabValues(labValues);

  if (extracted.length === 0) {
    return { inserted: 0, errors: [] };
  }

  const measuredAt = labDate
    ? new Date(labDate).toISOString()
    : new Date().toISOString();

  const errors: string[] = [];
  let inserted = 0;

  for (const vital of extracted) {
    // Check for duplicate: same patient, vital type, source, and health_record_id
    const { data: existing } = await supabase
      .from('vitals_history')
      .select('id')
      .eq('patient_id', patientId)
      .eq('vital_type', vital.vital_type)
      .eq('health_record_id', healthRecordId)
      .eq('source', 'lab_result')
      .maybeSingle();

    if (existing) {
      // Already extracted from this lab result, skip
      continue;
    }

    const { error } = await supabase
      .from('vitals_history')
      .insert({
        patient_id: patientId,
        vital_type: vital.vital_type,
        value: vital.value,
        unit: vital.unit,
        measured_at: measuredAt,
        source: 'lab_result',
        health_record_id: healthRecordId,
        notes_ar: `مستخلص من تحليل ${vital.test_code}`,
      });

    if (error) {
      errors.push(`Failed to insert ${vital.vital_type}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  return { inserted, errors };
}

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PatientLookupResult {
  id: string;
  name_ar: string;
  phone_number: string;
  visit_count: number;
}

/**
 * Look up a patient by phone number.
 * Returns the patient record with their total visit count if found.
 */
export async function lookupPatientByPhone(
  supabase: SupabaseClient,
  phone: string
): Promise<PatientLookupResult | null> {
  // Query patient by phone number
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, name_ar, phone_number')
    .eq('phone_number', phone)
    .maybeSingle();

  if (error) throw new Error(`Patient lookup failed: ${error.message}`);
  if (!patient) return null;

  // Get visit count from triage_sessions
  const { count, error: countError } = await supabase
    .from('triage_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patient.id);

  if (countError) throw new Error(`Visit count query failed: ${countError.message}`);

  return {
    id: patient.id,
    name_ar: patient.name_ar,
    phone_number: patient.phone_number,
    visit_count: count ?? 0,
  };
}

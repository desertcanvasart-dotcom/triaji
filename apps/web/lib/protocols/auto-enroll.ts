/**
 * Protocol Auto-Enrollment
 *
 * Checks the disease_protocols table for matching condition codes
 * and creates patient_protocol_enrollment records if not already enrolled.
 * Called from onboarding save when chronic conditions are recorded.
 */

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface EnrollmentResult {
  enrolled: string[];  // protocol IDs that were newly enrolled
  existing: string[];  // protocol IDs already enrolled
  errors: string[];
}

/**
 * Enroll a patient in all matching disease protocols based on their condition codes.
 *
 * @param patientId - The patient's UUID
 * @param conditionCodes - Array of ICD-10 or internal condition codes (e.g., ['E11', 'I10', 'N18'])
 * @returns Enrollment results
 */
export async function enrollPatientInProtocols(
  patientId: string,
  conditionCodes: string[]
): Promise<EnrollmentResult> {
  const result: EnrollmentResult = {
    enrolled: [],
    existing: [],
    errors: [],
  };

  if (!conditionCodes.length) return result;

  const supabase = getServiceClient();

  try {
    // 1. Fetch all active protocols matching any of the condition codes
    const { data: protocols, error: protocolError } = await supabase
      .from('disease_protocols')
      .select('id, condition_code, name_ar, name_en')
      .in('condition_code', conditionCodes)
      .eq('is_active', true);

    if (protocolError) {
      result.errors.push(`Failed to fetch protocols: ${protocolError.message}`);
      return result;
    }

    if (!protocols || protocols.length === 0) return result;

    // 2. Check existing enrollments for this patient
    const protocolIds = protocols.map(p => p.id);
    const { data: existingEnrollments } = await supabase
      .from('patient_protocol_enrollment')
      .select('protocol_id, is_active')
      .eq('patient_id', patientId)
      .in('protocol_id', protocolIds);

    const existingMap = new Map<string, boolean>();
    for (const e of existingEnrollments ?? []) {
      existingMap.set(e.protocol_id, e.is_active);
    }

    // 3. Enroll in new protocols
    const now = new Date().toISOString();
    for (const protocol of protocols) {
      const existingActive = existingMap.get(protocol.id);

      if (existingActive === true) {
        result.existing.push(protocol.id);
        continue;
      }

      // If previously deactivated, reactivate
      if (existingMap.has(protocol.id)) {
        const { error: updateError } = await supabase
          .from('patient_protocol_enrollment')
          .update({ is_active: true, enrolled_at: now, overall_compliance_pct: 100 })
          .eq('patient_id', patientId)
          .eq('protocol_id', protocol.id);

        if (updateError) {
          result.errors.push(`Reactivate ${protocol.id}: ${updateError.message}`);
        } else {
          result.enrolled.push(protocol.id);
        }
        continue;
      }

      // New enrollment
      const { error: insertError } = await supabase
        .from('patient_protocol_enrollment')
        .insert({
          patient_id: patientId,
          protocol_id: protocol.id,
          enrolled_at: now,
          is_active: true,
          overall_compliance_pct: 100,
        });

      if (insertError) {
        result.errors.push(`Enroll ${protocol.id}: ${insertError.message}`);
      } else {
        result.enrolled.push(protocol.id);
      }
    }

    console.log(
      `[auto-enroll] Patient ${patientId}: enrolled=${result.enrolled.length}, existing=${result.existing.length}, errors=${result.errors.length}`
    );

    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown enrollment error');
    return result;
  }
}

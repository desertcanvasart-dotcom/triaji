import type { SupabaseClient } from '@supabase/supabase-js';
import {
  specsForClinicMode,
  type DoctorDocumentType,
} from '@triaji/shared/constants/doctor-documents';

export interface DocumentReadiness {
  /** Required document types for this registration's clinic mode. */
  required: number;
  /** How many of those are uploaded AND approved. */
  approved: number;
  /** Required types with no document at all. */
  missing: DoctorDocumentType[];
  /** Required types uploaded but not yet approved (pending or rejected). */
  unapproved: DoctorDocumentType[];
  ready: boolean;
}

/**
 * Whether a registration's required documents have all been approved.
 *
 * Verification used to rest on a hand-typed syndicate number; approval is now
 * gated on a reviewer having actually looked at each required document.
 */
export async function getDocumentReadiness(
  supabase: SupabaseClient,
  doctorAccountId: string,
  clinicMode: string | null | undefined
): Promise<DocumentReadiness | { error: string }> {
  const specs = specsForClinicMode(clinicMode).filter((s) => s.required);

  const { data, error } = await supabase
    .from('doctor_documents')
    .select('doc_type, status')
    .eq('doctor_account_id', doctorAccountId);

  if (error) {
    return { error: error.message };
  }

  const statusByType = new Map<string, string>();
  for (const row of data ?? []) {
    statusByType.set(row.doc_type as string, row.status as string);
  }

  const missing: DoctorDocumentType[] = [];
  const unapproved: DoctorDocumentType[] = [];

  for (const spec of specs) {
    const status = statusByType.get(spec.type);
    if (!status) missing.push(spec.type);
    else if (status !== 'approved') unapproved.push(spec.type);
  }

  return {
    required: specs.length,
    approved: specs.length - missing.length - unapproved.length,
    missing,
    unapproved,
    ready: missing.length === 0 && unapproved.length === 0,
  };
}

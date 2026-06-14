/**
 * Medication Adherence Calculator
 *
 * Cross-references prescriptions from the last 90 days with
 * prescription_routing to determine dispensing status.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdherenceRecord {
  healthRecordId: string;
  documentNumber: string | null;
  prescriptionDate: string | null;
  prescribingDoctor: string | null;
  itemCount: number;
  status: 'dispensed' | 'sent_to_pharmacy' | 'not_dispensed';
  routingStatus: string | null;
  collectedAt: string | null;
}

// Prescription routing statuses that indicate the patient received the medication
const DISPENSED_STATUSES = new Set(['collected', 'ready', 'partial_ready']);
// Statuses that indicate the prescription is in the pharmacy pipeline
const IN_PIPELINE_STATUSES = new Set(['routed', 'received', 'checking_stock']);

/**
 * Calculate medication adherence for a patient over the last 90 days.
 *
 * @param supabase - Supabase service client
 * @param patientId - Patient UUID
 * @returns Array of AdherenceRecord with dispensing status
 */
export async function calculateAdherence(
  supabase: SupabaseClient,
  patientId: string
): Promise<AdherenceRecord[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  // Get prescriptions from last 90 days
  const { data: prescriptions, error: rxError } = await supabase
    .from('health_records')
    .select(`
      id,
      document_number,
      prescription_date,
      prescribing_doctor,
      prescription_items(id)
    `)
    .eq('patient_id', patientId)
    .eq('record_type', 'prescription')
    .is('deleted_at', null)
    .gte('prescription_date', ninetyDaysAgo)
    .order('prescription_date', { ascending: false });

  if (rxError) {
    throw new Error(`Failed to fetch prescriptions: ${rxError.message}`);
  }

  if (!prescriptions || prescriptions.length === 0) {
    return [];
  }

  // Get routing info for these prescriptions
  const healthRecordIds = prescriptions.map((rx: { id: string }) => rx.id);

  const { data: routings, error: routingError } = await supabase
    .from('prescription_routing')
    .select('health_record_id, status, collected_at')
    .in('health_record_id', healthRecordIds);

  if (routingError) {
    throw new Error(`Failed to fetch routing: ${routingError.message}`);
  }

  // Build routing map: health_record_id → routing info
  const routingMap = new Map<string, { status: string; collected_at: string | null }>();
  for (const r of routings ?? []) {
    routingMap.set(r.health_record_id, {
      status: r.status,
      collected_at: r.collected_at,
    });
  }

  // Build adherence records
  const records: AdherenceRecord[] = prescriptions.map(
    (rx: {
      id: string;
      document_number: string | null;
      prescription_date: string | null;
      prescribing_doctor: string | null;
      prescription_items: { id: string }[];
    }) => {
      const routing = routingMap.get(rx.id);
      let status: AdherenceRecord['status'] = 'not_dispensed';

      if (routing) {
        if (DISPENSED_STATUSES.has(routing.status)) {
          status = 'dispensed';
        } else if (IN_PIPELINE_STATUSES.has(routing.status)) {
          status = 'sent_to_pharmacy';
        }
      }

      return {
        healthRecordId: rx.id,
        documentNumber: rx.document_number,
        prescriptionDate: rx.prescription_date,
        prescribingDoctor: rx.prescribing_doctor,
        itemCount: rx.prescription_items?.length ?? 0,
        status,
        routingStatus: routing?.status ?? null,
        collectedAt: routing?.collected_at ?? null,
      };
    }
  );

  return records;
}

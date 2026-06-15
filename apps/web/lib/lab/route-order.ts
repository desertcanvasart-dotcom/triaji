/**
 * Lab Order Routing — Chain-Aware
 *
 * Routes lab orders through chain APIs when available,
 * falling back to manual routing when the API is unavailable.
 */

import { createServerClient } from '@triaji/shared/supabase';
import {
  getLabChainAdapter,
  isChainApiAvailable,
  type LabChainCode,
  type LabChainOrder,
  type LabChainPatient,
  type LabChainTest,
} from '@triaji/lab-chain-adapters';
import { notifyDoctorApiFallback } from './chain-notifications';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LabRoutingResult {
  success: boolean;
  routingId: string;
  method: 'chain_api' | 'manual';
  chainOrderId?: string;
  error?: string;
}

interface ChainConfig {
  chainCode: LabChainCode;
  branchId?: string;
}

// ─── Main Router ────────────────────────────────────────────────────────────────

/**
 * Route a lab order, preferring chain API when available.
 *
 * @param healthRecordId - The health_record ID linked to this lab order
 * @param labTenantId - The lab tenant that should fulfill the order
 * @param isUrgent - Whether the order should be marked urgent
 */
export async function routeLabOrder(
  healthRecordId: string,
  labTenantId: string,
  isUrgent: boolean,
): Promise<LabRoutingResult> {
  const supabase = createServerClient();

  // ─── Lookup chain config for this lab tenant ────────────────────────────────
  const chainConfig = await getChainConfig(supabase, labTenantId);

  if (chainConfig && isChainApiAvailable(chainConfig.chainCode)) {
    return routeViaChainApi(supabase, healthRecordId, labTenantId, chainConfig, isUrgent);
  }

  return routeManually(supabase, healthRecordId, labTenantId, isUrgent);
}

// ─── Chain Config Lookup ────────────────────────────────────────────────────────

async function getChainConfig(
  supabase: ReturnType<typeof createServerClient>,
  labTenantId: string,
): Promise<ChainConfig | null> {
  // A lab tenant maps to a chain via tenants.chain_id → lab_chains.id → lab_chains.code.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('chain_id')
    .eq('id', labTenantId)
    .single();

  if (!tenant?.chain_id) return null;

  const { data: chainRow } = await supabase
    .from('lab_chains')
    .select('code')
    .eq('id', tenant.chain_id)
    .eq('is_active', true)
    .maybeSingle();

  const chainCode = chainRow?.code as string | undefined;
  if (chainCode && ['alborg', 'almokhtabar', 'alfa'].includes(chainCode)) {
    return { chainCode: chainCode as LabChainCode };
  }

  return null;
}

// ─── Chain API Routing ──────────────────────────────────────────────────────────

async function routeViaChainApi(
  supabase: ReturnType<typeof createServerClient>,
  healthRecordId: string,
  labTenantId: string,
  chainConfig: ChainConfig,
  isUrgent: boolean,
): Promise<LabRoutingResult> {
  const { chainCode, branchId } = chainConfig;

  // Fetch health record + patient data to build the chain order
  const { data: healthRecord, error: hrError } = await supabase
    .from('health_records')
    .select(`
      id,
      patient_id,
      lab_values,
      patient:patients!health_records_patient_id_fkey (
        id,
        name_ar,
        phone_number,
        patient_profiles ( date_of_birth, preferred_language, biological_sex )
      )
    `)
    .eq('id', healthRecordId)
    .single();

  if (hrError || !healthRecord) {
    return { success: false, routingId: '', method: 'chain_api', error: 'Health record not found' };
  }

  const patient = healthRecord.patient as unknown as Record<string, string> | null;
  if (!patient) {
    return { success: false, routingId: '', method: 'chain_api', error: 'Patient not found' };
  }

  // Map test codes via lab_chain_test_mapping. health_records has no test-code column;
  // ordered tests live in lab_order_items (names only, no chain-mappable codes), so until
  // coded ordering exists the chain order carries no coded tests.
  const testCodes: string[] = [];
  const chainTests = await mapTestCodes(supabase, chainCode, testCodes);

  // Build chain order
  const patientProfile = (patient.patient_profiles as unknown as
    | { date_of_birth: string | null; preferred_language: string | null; biological_sex: string | null }[]
    | null)?.[0];
  const chainPatient: LabChainPatient = {
    name: patient.name_ar ?? '',
    phone: patient.phone_number ?? '',
    // national_id is not stored in this schema (neither patients nor patient_profiles).
    dateOfBirth: patientProfile?.date_of_birth ?? undefined,
    gender: (patientProfile?.biological_sex as 'male' | 'female' | undefined) ?? undefined,
  };

  const chainOrder: LabChainOrder = {
    tenantId: labTenantId,
    patientId: patient.id ?? '',
    patient: chainPatient,
    tests: chainTests,
    branchId,
    notes: isUrgent ? 'URGENT' : undefined,
  };

  // Create routing record first (status = 'submitted')
  const { data: routing, error: routingError } = await supabase
    .from('lab_order_routing')
    .insert({
      health_record_id: healthRecordId,
      lab_tenant_id: labTenantId,
      chain_code: chainCode,
      status: 'submitted',
      is_urgent: isUrgent,
      api_submission_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (routingError || !routing) {
    return { success: false, routingId: '', method: 'chain_api', error: 'Failed to create routing record' };
  }

  const routingId = routing.id as string;

  try {
    const adapter = getLabChainAdapter(chainCode);
    const result = await adapter.submitOrder(chainOrder);

    if (result.success && result.orderId) {
      // Update routing with chain order ID
      await supabase
        .from('lab_order_routing')
        .update({
          chain_order_id: result.orderId,
          status: 'received',
        })
        .eq('id', routingId);

      return {
        success: true,
        routingId,
        method: 'chain_api',
        chainOrderId: result.orderId,
      };
    }

    // API returned an error — fall back to manual
    await handleApiFallback(supabase, routingId, chainCode, result.error ?? 'Unknown API error');

    return {
      success: true,
      routingId,
      method: 'manual',
      error: `Chain API error: ${result.error}. Fell back to manual routing.`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    await handleApiFallback(supabase, routingId, chainCode, errorMsg);

    return {
      success: true,
      routingId,
      method: 'manual',
      error: `Chain API exception: ${errorMsg}. Fell back to manual routing.`,
    };
  }
}

// ─── Manual Routing ─────────────────────────────────────────────────────────────

async function routeManually(
  supabase: ReturnType<typeof createServerClient>,
  healthRecordId: string,
  labTenantId: string,
  isUrgent: boolean,
): Promise<LabRoutingResult> {
  const { data: routing, error } = await supabase
    .from('lab_order_routing')
    .insert({
      health_record_id: healthRecordId,
      lab_tenant_id: labTenantId,
      status: 'pending_manual',
      is_urgent: isUrgent,
    })
    .select('id')
    .single();

  if (error || !routing) {
    return { success: false, routingId: '', method: 'manual', error: 'Failed to create routing record' };
  }

  return {
    success: true,
    routingId: routing.id as string,
    method: 'manual',
  };
}

// ─── API Fallback Handler ───────────────────────────────────────────────────────

async function handleApiFallback(
  supabase: ReturnType<typeof createServerClient>,
  routingId: string,
  chainCode: LabChainCode,
  errorMsg: string,
): Promise<void> {
  // Increment error count, set manual fallback
  const { data: current } = await supabase
    .from('lab_order_routing')
    .select('api_error_count')
    .eq('id', routingId)
    .single();

  const errorCount = ((current?.api_error_count as number) ?? 0) + 1;

  await supabase
    .from('lab_order_routing')
    .update({
      status: 'pending_manual',
      manual_fallback_active: true,
      api_error_count: errorCount,
      last_api_error: errorMsg,
    })
    .eq('id', routingId);

  // Notify the referring doctor
  await notifyDoctorApiFallback(routingId, chainCode).catch((err) => {
    console.error(`[route-order] Failed to notify doctor about fallback:`, err);
  });
}

// ─── Test Code Mapping ──────────────────────────────────────────────────────────

async function mapTestCodes(
  supabase: ReturnType<typeof createServerClient>,
  chainCode: LabChainCode,
  triajiCodes: string[],
): Promise<LabChainTest[]> {
  if (triajiCodes.length === 0) return [];

  const { data: mappings } = await supabase
    .from('lab_chain_test_mapping')
    .select('triaji_code, chain_test_code, chain_test_name_ar')
    .eq('chain_code', chainCode)
    .in('triaji_code', triajiCodes);

  const mappingMap = new Map(
    (mappings ?? []).map((m) => [m.triaji_code, m]),
  );

  return triajiCodes.map((code) => {
    const mapping = mappingMap.get(code);
    return {
      code,
      chainCode: mapping?.chain_test_code,
      name: mapping?.chain_test_name_ar ?? code,
      nameAr: mapping?.chain_test_name_ar,
    };
  });
}

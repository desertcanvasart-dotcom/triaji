/**
 * HIS Availability Sync (Admin)
 *
 * Re-exports sync logic for the admin manual sync route.
 * Uses the same algorithm as apps/web/lib/his/sync.ts.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { getAdapter, type HisAdapterConfig, type SyncResult, type SyncError } from '@triaji/his-adapters';
import { decryptCredentials } from './crypto';

interface HisIntegrationRow {
  id: string;
  tenant_id: string;
  vendor: string;
  base_url: string;
  auth_type: string;
  credentials_encrypted: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  adapter_version: string;
}

interface DoctorMapping {
  id: string;
  his_doctor_id: string;
  tenant_id: string;
}

/**
 * Run sync for a single tenant (admin context).
 */
export async function syncTenant(
  integration: HisIntegrationRow,
  triggeredBy: 'cron' | 'manual' | 'webhook' = 'manual'
): Promise<SyncResult> {
  const supabase = createAdminClient();
  const errors: SyncError[] = [];
  let slotsAdded = 0;
  let slotsRemoved = 0;
  let doctorsSynced = 0;

  // Create sync log entry
  const { data: logEntry } = await supabase
    .from('his_sync_logs')
    .insert({
      tenant_id: integration.tenant_id,
      status: 'running',
      triggered_by: triggeredBy,
    })
    .select('id')
    .single();

  const logId = logEntry?.id as string | undefined;

  try {
    // Decrypt credentials
    const credentials = decryptCredentials(
      typeof integration.credentials_encrypted === 'string'
        ? integration.credentials_encrypted
        : JSON.stringify(integration.credentials_encrypted)
    );

    // Build adapter config
    const adapterConfig: HisAdapterConfig = {
      vendor: integration.vendor as HisAdapterConfig['vendor'],
      baseUrl: integration.base_url,
      authType: integration.auth_type as HisAdapterConfig['authType'],
      credentials: credentials as HisAdapterConfig['credentials'],
      tenantId: integration.tenant_id,
      fieldMapping: (credentials['field_mapping'] as Record<string, string>) ?? undefined,
    };

    const adapter = getAdapter(adapterConfig);

    // Get all doctors with HIS mappings for this tenant
    const { data: doctors } = await supabase
      .from('doctors')
      .select('id, his_doctor_id, tenant_id')
      .eq('tenant_id', integration.tenant_id)
      .not('his_doctor_id', 'is', null);

    const mappedDoctors = (doctors ?? []) as DoctorMapping[];

    if (mappedDoctors.length === 0) {
      const result: SyncResult = {
        doctorsSynced: 0,
        slotsAdded: 0,
        slotsRemoved: 0,
        errors: [{ hisDoctorId: '', message: 'No doctors mapped to HIS', code: 'NO_MAPPINGS' }],
        syncedAt: new Date().toISOString(),
      };
      await finishLog(supabase, logId, 'partial', result);
      return result;
    }

    // Date range: now → 14 days
    const fromDate = new Date().toISOString();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 14);
    const toDateStr = toDate.toISOString();

    // Sync each doctor
    for (const doc of mappedDoctors) {
      try {
        const hisSlots = await adapter.fetchAvailability(
          doc.his_doctor_id,
          fromDate,
          toDateStr
        );

        const availableSlots = hisSlots.filter((s) => s.isAvailable);

        // Upsert slots into doctor_availability
        for (const slot of availableSlots) {
          const { error: upsertError } = await supabase
            .from('doctor_availability')
            .upsert(
              {
                doctor_id: doc.id,
                tenant_id: integration.tenant_id,
                source: 'his_sync',
                slot_datetime: slot.datetime,
                duration_minutes: slot.durationMinutes,
                is_booked: false,
                his_slot_id: slot.hisSlotId,
              },
              { onConflict: 'doctor_id,slot_datetime' }
            );

          if (upsertError) {
            errors.push({
              hisDoctorId: doc.his_doctor_id,
              message: upsertError.message,
              code: 'UPSERT_ERROR',
            });
          } else {
            slotsAdded++;
          }
        }

        // Remove HIS-synced slots that no longer appear in HIS
        // NEVER remove slots with is_booked = true
        const hisSlotIds = availableSlots.map((s) => s.hisSlotId);

        if (hisSlotIds.length > 0) {
          const { data: existingSlots } = await supabase
            .from('doctor_availability')
            .select('id, his_slot_id')
            .eq('doctor_id', doc.id)
            .eq('source', 'his_sync')
            .eq('is_booked', false)
            .gte('slot_datetime', fromDate);

          const slotsToRemove = (existingSlots ?? []).filter(
            (s) => s.his_slot_id && !hisSlotIds.includes(s.his_slot_id as string)
          );

          if (slotsToRemove.length > 0) {
            const ids = slotsToRemove.map((s) => s.id);
            await supabase
              .from('doctor_availability')
              .delete()
              .in('id', ids)
              .eq('is_booked', false);
            slotsRemoved += slotsToRemove.length;
          }
        }

        doctorsSynced++;
      } catch (err) {
        errors.push({
          hisDoctorId: doc.his_doctor_id,
          message: err instanceof Error ? err.message : 'Unknown error',
          code: 'FETCH_ERROR',
        });
      }
    }

    // Update last_sync_at
    await supabase
      .from('his_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    const status = errors.length > 0
      ? (doctorsSynced > 0 ? 'partial' : 'failed')
      : 'success';

    const result: SyncResult = {
      doctorsSynced,
      slotsAdded,
      slotsRemoved,
      errors,
      syncedAt: new Date().toISOString(),
    };

    await finishLog(supabase, logId, status, result);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const result: SyncResult = {
      doctorsSynced: 0,
      slotsAdded: 0,
      slotsRemoved: 0,
      errors: [{ hisDoctorId: '', message: errorMsg, code: 'SYNC_FATAL' }],
      syncedAt: new Date().toISOString(),
    };
    await finishLog(supabase, logId, 'failed', result);
    return result;
  }
}

async function finishLog(
  supabase: ReturnType<typeof createAdminClient>,
  logId: string | undefined,
  status: string,
  result: SyncResult
) {
  if (!logId) return;
  await supabase
    .from('his_sync_logs')
    .update({
      sync_ended_at: new Date().toISOString(),
      status,
      doctors_synced: result.doctorsSynced,
      slots_added: result.slotsAdded,
      slots_removed: result.slotsRemoved,
      errors: result.errors,
    })
    .eq('id', logId);
}

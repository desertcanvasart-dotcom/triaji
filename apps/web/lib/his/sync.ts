/**
 * HIS Availability Sync
 *
 * Pulls doctor availability from a hospital's HIS and upserts into
 * DoctorTrio's doctor_availability table. Used by the cron job and manual sync.
 */

import { createServerClient } from '@triaji/shared/supabase';
import { getAdapter, type HisAdapterConfig } from '@triaji/his-adapters';
import type { SyncResult, SyncError } from '@triaji/his-adapters';
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
 * Run sync for a single tenant.
 */
export async function syncTenant(
  integration: HisIntegrationRow,
  triggeredBy: 'cron' | 'manual' | 'webhook' = 'cron'
): Promise<SyncResult> {
  const supabase = createServerClient();
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

  const logId = logEntry?.id;

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

        // Only available slots
        const availableSlots = hisSlots.filter((s) => s.isAvailable);

        // Insert HIS slots into doctor_availability.
        //
        // There is no unique constraint on (doctor_id, slot_datetime), so a real
        // upsert with `onConflict` raises Postgres 42P10 ("no unique or exclusion
        // constraint matching the ON CONFLICT specification") on every row and no
        // slots are ever added. Instead we find-or-insert per slot, and crucially
        // NEVER overwrite a booked slot or a manually-created (non-his_sync) one —
        // a blind upsert would reset is_booked to false and un-book real bookings.
        for (const slot of availableSlots) {
          const { data: existingRows, error: findError } = await supabase
            .from('doctor_availability')
            .select('id, is_booked, source')
            .eq('doctor_id', doc.id)
            .eq('slot_datetime', slot.datetime)
            .limit(1);

          if (findError) {
            errors.push({
              hisDoctorId: doc.his_doctor_id,
              message: findError.message,
              code: 'UPSERT_ERROR',
            });
            continue;
          }

          const existing = existingRows?.[0];

          if (!existing) {
            const { error: insertError } = await supabase
              .from('doctor_availability')
              .insert({
                doctor_id: doc.id,
                tenant_id: integration.tenant_id,
                source: 'his_sync',
                slot_datetime: slot.datetime,
                duration_minutes: slot.durationMinutes,
                is_booked: false,
                his_slot_id: slot.hisSlotId,
              });

            if (insertError) {
              errors.push({
                hisDoctorId: doc.his_doctor_id,
                message: insertError.message,
                code: 'UPSERT_ERROR',
              });
            } else {
              slotsAdded++;
            }
          } else if (existing.source === 'his_sync' && !existing.is_booked) {
            // Refresh an existing, still-open HIS slot's metadata. The
            // is_booked guard makes a concurrent booking win over this update.
            const { error: updateError } = await supabase
              .from('doctor_availability')
              .update({
                duration_minutes: slot.durationMinutes,
                his_slot_id: slot.hisSlotId,
              })
              .eq('id', existing.id)
              .eq('is_booked', false);

            if (updateError) {
              errors.push({
                hisDoctorId: doc.his_doctor_id,
                message: updateError.message,
                code: 'UPSERT_ERROR',
              });
            }
          }
          // else: existing slot is booked or manually created — leave it untouched.
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
  supabase: ReturnType<typeof createServerClient>,
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

/**
 * ICU HIS Sync Cron Route
 *
 * GET /api/cron/icu-his-sync
 * Called every 15 minutes by Railway cron (every 15 min schedule).
 * Protected by x-cron-secret header.
 *
 * For each tenant with active HIS integration:
 *   1. Query icu_units with update_source='his_sync'
 *   2. Get HIS adapter via factory
 *   3. Call adapter.getIcuAvailability() (skip if method doesn't exist)
 *   4. Match returned units to icu_units by his_unit_id
 *   5. If available_beds changed: UPDATE icu_units, INSERT icu_availability_log
 *
 * One failing tenant does not block others.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAdapter } from '@triaji/his-adapters';
import type { HisAdapterConfig } from '@triaji/his-adapters';

interface HisIntegrationRow {
  id: string;
  tenant_id: string;
  vendor: string;
  base_url: string;
  auth_type: string;
  credentials_encrypted: string;
  sync_enabled: boolean;
}

interface IcuUnitRow {
  id: string;
  tenant_id: string;
  his_unit_id: string | null;
  unit_type: string;
  available_beds: number;
  total_beds: number;
  update_source: string;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  // Find all active HIS integrations
  const { data: integrations, error: intError } = await supabase
    .from('his_integrations')
    .select('*')
    .eq('sync_enabled', true);

  if (intError) {
    console.error('[ICU HIS Sync] Failed to load integrations:', intError.message);
    return NextResponse.json(
      { error: 'Failed to load integrations' },
      { status: 500 }
    );
  }

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({
      message: 'No active HIS integrations to sync',
      synced: 0,
      skipped: 0,
      errors: 0,
    });
  }

  // Get all icu_units with update_source='his_sync' for relevant tenants
  const tenantIds = (integrations as HisIntegrationRow[]).map((i) => i.tenant_id);
  const { data: icuUnits, error: unitsError } = await supabase
    .from('icu_units')
    .select('*')
    .in('tenant_id', tenantIds)
    .eq('update_source', 'his_sync');

  if (unitsError) {
    console.error('[ICU HIS Sync] Failed to load ICU units:', unitsError.message);
    return NextResponse.json(
      { error: 'Failed to load ICU units' },
      { status: 500 }
    );
  }

  // Group ICU units by tenant_id for fast lookup
  const unitsByTenant = new Map<string, IcuUnitRow[]>();
  for (const unit of (icuUnits ?? []) as IcuUnitRow[]) {
    const existing = unitsByTenant.get(unit.tenant_id) ?? [];
    existing.push(unit);
    unitsByTenant.set(unit.tenant_id, existing);
  }

  // Process each tenant independently
  for (const integration of integrations as HisIntegrationRow[]) {
    try {
      const tenantUnits = unitsByTenant.get(integration.tenant_id);
      if (!tenantUnits || tenantUnits.length === 0) {
        skipped++;
        continue;
      }

      // Build adapter config
      const adapterConfig: HisAdapterConfig = {
        vendor: integration.vendor as HisAdapterConfig['vendor'],
        baseUrl: integration.base_url,
        authType: integration.auth_type as HisAdapterConfig['authType'],
        credentials: JSON.parse(integration.credentials_encrypted),
        tenantId: integration.tenant_id,
      };

      const adapter = getAdapter(adapterConfig);

      // Skip if adapter doesn't implement getIcuAvailability
      if (typeof adapter.getIcuAvailability !== 'function') {
        skipped++;
        continue;
      }

      const hisAvailability = await adapter.getIcuAvailability();

      if (!hisAvailability || hisAvailability.length === 0) {
        skipped++;
        continue;
      }

      // Build lookup by his_unit_id
      const hisMap = new Map(
        hisAvailability.map((h) => [h.hisUnitId, h])
      );

      // Match and update
      for (const unit of tenantUnits) {
        if (!unit.his_unit_id) continue;

        const hisData = hisMap.get(unit.his_unit_id);
        if (!hisData) continue;

        // Only update if available_beds changed
        if (hisData.availableBeds === unit.available_beds) continue;

        const previousBeds = unit.available_beds;

        // Update icu_units
        const { error: updateError } = await supabase
          .from('icu_units')
          .update({
            available_beds: hisData.availableBeds,
            total_beds: hisData.totalBeds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', unit.id);

        if (updateError) {
          console.error(
            `[ICU HIS Sync] Failed to update unit ${unit.id}:`,
            updateError.message
          );
          errors++;
          continue;
        }

        // Insert availability log
        await supabase.from('icu_availability_log').insert({
          icu_unit_id: unit.id,
          tenant_id: integration.tenant_id,
          new_available: hisData.availableBeds,
          previous_available: previousBeds,
          change_reason: 'his_sync',
          created_at: new Date().toISOString(),
        });

        synced++;
      }
    } catch (err) {
      console.error(
        `[ICU HIS Sync] Error syncing tenant ${integration.tenant_id}:`,
        err instanceof Error ? err.message : err
      );
      errors++;
    }
  }

  console.log(
    `[ICU HIS Sync] Complete: synced=${synced}, skipped=${skipped}, errors=${errors}`
  );

  return NextResponse.json({
    synced,
    skipped,
    errors,
  });
}

/**
 * HIS Sync Cron Route
 *
 * GET /api/cron/his-sync
 * Called every 30 minutes by Railway cron.
 * Protected by x-cron-secret header.
 *
 * For each tenant with active HIS integration + sync_enabled:
 *   1. Load HIS config, decrypt credentials
 *   2. Get adapter via factory
 *   3. Sync availability for all HIS-linked doctors
 *   4. Log result to his_sync_logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { syncTenant } from '@/lib/his/sync';
import type { SyncResult } from '@triaji/his-adapters';

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

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const results: Array<{
    tenantId: string;
    vendor: string;
    result: SyncResult;
  }> = [];

  // Find all active HIS integrations with sync enabled
  const { data: integrations, error } = await supabase
    .from('his_integrations')
    .select('*')
    .eq('sync_enabled', true);

  if (error) {
    console.error('[HIS Cron] Failed to load integrations:', error.message);
    return NextResponse.json(
      { error: 'Failed to load integrations' },
      { status: 500 }
    );
  }

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({
      message: 'No active HIS integrations to sync',
      synced: [],
    });
  }

  // Sync each tenant sequentially to avoid overwhelming HIS servers
  for (const integration of integrations as HisIntegrationRow[]) {
    try {
      const result = await syncTenant(integration, 'cron');
      results.push({
        tenantId: integration.tenant_id,
        vendor: integration.vendor,
        result,
      });
    } catch (err) {
      console.error(
        `[HIS Cron] Fatal error syncing tenant ${integration.tenant_id}:`,
        err instanceof Error ? err.message : err
      );
      results.push({
        tenantId: integration.tenant_id,
        vendor: integration.vendor,
        result: {
          doctorsSynced: 0,
          slotsAdded: 0,
          slotsRemoved: 0,
          errors: [{
            hisDoctorId: '',
            message: err instanceof Error ? err.message : 'Unknown fatal error',
            code: 'CRON_FATAL',
          }],
          syncedAt: new Date().toISOString(),
        },
      });
    }
  }

  const totalSynced = results.reduce((sum, r) => sum + r.result.doctorsSynced, 0);
  const totalSlots = results.reduce((sum, r) => sum + r.result.slotsAdded, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.result.errors.length, 0);

  console.log(
    `[HIS Cron] Complete: ${results.length} tenants, ${totalSynced} doctors, ${totalSlots} slots, ${totalErrors} errors`
  );

  return NextResponse.json({
    tenantsProcessed: results.length,
    totalDoctorsSynced: totalSynced,
    totalSlotsAdded: totalSlots,
    totalErrors,
    synced: results.map((r) => ({
      tenantId: r.tenantId,
      vendor: r.vendor,
      doctorsSynced: r.result.doctorsSynced,
      slotsAdded: r.result.slotsAdded,
      slotsRemoved: r.result.slotsRemoved,
      errorCount: r.result.errors.length,
      status: r.result.errors.length > 0
        ? (r.result.doctorsSynced > 0 ? 'partial' : 'failed')
        : 'success',
    })),
  });
}

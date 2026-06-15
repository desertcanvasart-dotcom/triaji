/**
 * POST /api/admin/his/sync — Trigger manual sync for this tenant
 * Same logic as the cron job but for a single tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { syncTenant } from '@/lib/his/sync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;

  if (!admin.tenant_id) {
    return NextResponse.json(
      { error: 'Platform admins must specify a tenant context' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Load HIS integration for this tenant
  const { data: integration } = await supabase
    .from('his_integrations')
    .select('*')
    .eq('tenant_id', admin.tenant_id)
    .eq('sync_enabled', true)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: 'No active HIS integration found' },
      { status: 404 }
    );
  }

  try {
    const result = await syncTenant(
      {
        id: integration.id as string,
        tenant_id: integration.tenant_id as string,
        vendor: integration.vendor as string,
        base_url: integration.base_url as string,
        auth_type: integration.auth_type as string,
        credentials_encrypted: integration.credentials_encrypted as string,
        sync_enabled: integration.sync_enabled as boolean,
        last_sync_at: integration.last_sync_at as string | null,
        adapter_version: (integration.adapter_version as string) ?? '1.0.0',
      },
      'manual'
    );

    const status = result.errors.length > 0
      ? (result.doctorsSynced > 0 ? 'partial' : 'failed')
      : 'success';

    return NextResponse.json({
      status,
      doctorsSynced: result.doctorsSynced,
      slotsAdded: result.slotsAdded,
      slotsRemoved: result.slotsRemoved,
      errors: result.errors,
      syncedAt: result.syncedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

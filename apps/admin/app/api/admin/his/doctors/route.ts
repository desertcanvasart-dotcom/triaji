/**
 * GET /api/admin/his/doctors — Fetch doctors from connected HIS
 * Returns both HIS doctors and DoctorTrio doctors for mapping UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdapter } from '@triaji/his-adapters';
import type { HisAdapterConfig } from '@triaji/his-adapters';
import { decryptCredentials } from '@/lib/his/crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

  // Load HIS integration
  const { data: integration } = await supabase
    .from('his_integrations')
    .select('*')
    .eq('tenant_id', admin.tenant_id)
    .eq('sync_enabled', true)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: 'No active HIS integration found. Connect to a HIS first.' },
      { status: 404 }
    );
  }

  // Decrypt credentials
  const credentials = decryptCredentials(
    typeof integration.credentials_encrypted === 'string'
      ? integration.credentials_encrypted
      : JSON.stringify(integration.credentials_encrypted)
  );

  // Build adapter
  const config: HisAdapterConfig = {
    vendor: integration.vendor as HisAdapterConfig['vendor'],
    baseUrl: integration.base_url as string,
    authType: integration.auth_type as HisAdapterConfig['authType'],
    credentials: credentials as HisAdapterConfig['credentials'],
    tenantId: admin.tenant_id,
    fieldMapping: (credentials['field_mapping'] as Record<string, string>) ?? undefined,
  };

  try {
    const adapter = getAdapter(config);
    const hisDoctors = await adapter.fetchDoctors();

    // Also fetch DoctorTrio doctors for this tenant (for mapping UI)
    const { data: triajiDoctors } = await supabase
      .from('doctors')
      .select('id, name_ar, name_en, his_doctor_id, specialty_id')
      .eq('tenant_id', admin.tenant_id)
      .eq('is_active', true)
      .order('name_ar');

    return NextResponse.json({
      hisDoctors,
      triajiDoctors: triajiDoctors ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch HIS doctors' },
      { status: 500 }
    );
  }
}

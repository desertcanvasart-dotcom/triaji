/**
 * POST /api/admin/his/connect — Save validated HIS credentials (encrypted)
 * Credentials are encrypted with AES-256-GCM before storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { encryptCredentials } from '@/lib/his/crypto';

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

  const body = await request.json();

  const vendor = body['vendor'] as string;
  const baseUrl = body['base_url'] as string;
  const authType = body['auth_type'] as string;
  const credentials = body['credentials'] as Record<string, unknown>;
  const bookingMode = (body['booking_mode'] as string) ?? 'hybrid';

  if (!vendor || !baseUrl || !authType || !credentials) {
    return NextResponse.json(
      { error: 'Missing required fields: vendor, base_url, auth_type, credentials' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Encrypt credentials
  const encrypted = encryptCredentials(credentials);

  // Check if integration already exists for this tenant
  const { data: existing } = await supabase
    .from('his_integrations')
    .select('id')
    .eq('tenant_id', admin.tenant_id)
    .single();

  // booking_mode lives on tenant_config, not his_integrations.
  const { error: configError } = await supabase
    .from('tenant_config')
    .upsert(
      { tenant_id: admin.tenant_id, booking_mode: bookingMode },
      { onConflict: 'tenant_id' }
    );

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  if (existing) {
    // Update existing integration
    const { error } = await supabase
      .from('his_integrations')
      .update({
        vendor,
        base_url: baseUrl,
        auth_type: authType,
        credentials_encrypted: encrypted,
        sync_enabled: true,
      })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'HIS integration updated successfully',
      integrationId: existing.id,
    });
  }

  // Create new integration
  const { data, error } = await supabase
    .from('his_integrations')
    .insert({
      tenant_id: admin.tenant_id,
      vendor,
      base_url: baseUrl,
      auth_type: authType,
      credentials_encrypted: encrypted,
      sync_enabled: true,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'HIS integration connected successfully',
    integrationId: data.id,
  }, { status: 201 });
}

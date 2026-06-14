/**
 * POST /api/admin/his/test — Test HIS connection with provided credentials
 * Does NOT save credentials — only validates them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { getAdapter } from '@triaji/his-adapters';
import type { HisAdapterConfig } from '@triaji/his-adapters';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();

  const vendor = body['vendor'] as string;
  const baseUrl = body['base_url'] as string;
  const authType = body['auth_type'] as string;
  const credentials = body['credentials'] as Record<string, string>;

  if (!vendor || !baseUrl || !authType || !credentials) {
    return NextResponse.json(
      { error: 'Missing required fields: vendor, base_url, auth_type, credentials' },
      { status: 400 }
    );
  }

  const validVendors = ['shifa', 'generic_rest', 'mock'];
  if (!validVendors.includes(vendor)) {
    return NextResponse.json(
      { error: `Invalid vendor. Must be one of: ${validVendors.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const config: HisAdapterConfig = {
      vendor: vendor as HisAdapterConfig['vendor'],
      baseUrl,
      authType: authType as HisAdapterConfig['authType'],
      credentials: credentials as HisAdapterConfig['credentials'],
      tenantId: '',
      fieldMapping: (credentials['field_mapping'] as unknown as Record<string, string>) ?? undefined,
    };

    const adapter = getAdapter(config);
    const result = await adapter.testConnection();

    return NextResponse.json({
      success: result.success,
      message: result.message,
      version: result.version ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : 'Connection test failed',
    });
  }
}

/**
 * POST /api/admin/phone/english-toggle
 * Toggle English language support for a tenant's phone line.
 * Updates tenant_config.english_enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { tenantId, enabled } = body as { tenantId: string; enabled: boolean };

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('tenant_config')
      .update({ english_enabled: enabled })
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[Admin Phone] Failed to toggle english_enabled:', error.message);
      return NextResponse.json(
        { error: 'Failed to update setting' },
        { status: 500 }
      );
    }

    console.log(`[Admin Phone] english_enabled=${enabled} for tenant ${tenantId}`);

    return NextResponse.json({ success: true, english_enabled: enabled });
  } catch (err) {
    console.error('[Admin Phone] Toggle error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

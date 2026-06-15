/**
 * DELETE /api/admin/his/disconnect — Remove HIS integration
 * Soft-deletes by setting sync_enabled = false.
 * Does NOT delete doctor mappings — those remain for reference.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
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

  const { error } = await supabase
    .from('his_integrations')
    .update({
      sync_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', admin.tenant_id)
    .eq('sync_enabled', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'HIS integration disconnected. Doctor mappings preserved.',
  });
}

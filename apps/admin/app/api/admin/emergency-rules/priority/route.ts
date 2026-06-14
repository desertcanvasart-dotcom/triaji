import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/emergency-rules/priority — bulk reorder */
export async function PUT(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const updates: Array<{ id: string; priority: number }> = body['updates'] ?? [];

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided.' }, { status: 400 });
  }

  for (const update of updates) {
    const { error } = await supabase
      .from('emergency_triggers')
      .update({ priority: update.priority })
      .eq('id', update.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, updated: updates.length });
}

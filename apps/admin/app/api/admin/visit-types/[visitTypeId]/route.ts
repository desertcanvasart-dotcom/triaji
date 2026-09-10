import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** DELETE /api/admin/visit-types/[visitTypeId] — remove a visit type.
 *  Slots that referenced it keep their duration (FK is ON DELETE SET NULL). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ visitTypeId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { visitTypeId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase.from('doctor_visit_types').delete().eq('id', visitTypeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

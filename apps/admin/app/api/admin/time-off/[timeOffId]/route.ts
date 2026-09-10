import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** DELETE /api/admin/time-off/[timeOffId] — remove a block (unblocks the time) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ timeOffId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { timeOffId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase.from('doctor_time_off').delete().eq('id', timeOffId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

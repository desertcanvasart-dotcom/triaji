import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** DELETE /api/admin/slots/[slotId] — delete slot (reject if booked) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { slotId } = await params;
  const supabase = createAdminClient();

  // Check if slot exists and if it's booked
  const { data: slot, error: fetchError } = await supabase
    .from('doctor_availability')
    .select('id, is_booked')
    .eq('id', slotId)
    .single();

  if (fetchError || !slot) {
    return NextResponse.json({ error: 'Slot not found.' }, { status: 404 });
  }

  if (slot.is_booked) {
    return NextResponse.json(
      { error: 'This slot has a booking and cannot be deleted.' },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('doctor_availability')
    .delete()
    .eq('id', slotId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

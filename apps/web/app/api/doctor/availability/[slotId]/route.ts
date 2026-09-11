import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDoctorAccount,
  getDoctorServiceClient,
} from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

/** DELETE /api/doctor/availability/[slotId] — remove one of the doctor's own
 *  unbooked slots. Booked slots are protected. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account || !account.doctor_id) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const { slotId } = await params;
  const supabase = getDoctorServiceClient();

  // The slot must belong to this doctor.
  const { data: slot } = await supabase
    .from('doctor_availability')
    .select('id, is_booked')
    .eq('id', slotId)
    .eq('doctor_id', account.doctor_id)
    .single();

  if (!slot) {
    return NextResponse.json({ error: 'الموعد مش موجود' }, { status: 404 });
  }
  if (slot.is_booked) {
    return NextResponse.json({ error: 'الموعد ده محجوز ومينفعش يتشال' }, { status: 409 });
  }

  const { error } = await supabase
    .from('doctor_availability')
    .delete()
    .eq('id', slotId)
    .eq('doctor_id', account.doctor_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

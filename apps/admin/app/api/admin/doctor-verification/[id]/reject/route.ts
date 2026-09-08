import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyDoctorRejected } from '@/lib/auth/verification-notifications';

export const dynamic = 'force-dynamic';

/** POST /api/admin/doctor-verification/[id]/reject — reject a doctor */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const reason: string = body.reason ?? '';

  if (!reason.trim()) {
    return NextResponse.json(
      { error: 'Rejection reason is required.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: doctorAccount, error: fetchError } = await supabase
    .from('doctor_accounts')
    .select('id, phone')
    .eq('id', id)
    .single();

  if (fetchError || !doctorAccount) {
    return NextResponse.json(
      { error: 'Doctor account not found.' },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase
    .from('doctor_accounts')
    .update({
      verification_status: 'rejected',
      rejection_reason: reason,
      verified_by: admin.id,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // Let the doctor know, with the reason (best-effort; never blocks).
  await notifyDoctorRejected(doctorAccount.phone as string | null, reason);

  return NextResponse.json({ success: true, message: 'Doctor registration rejected.' });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST /api/admin/doctor-verification/[id]/approve — verify a doctor */
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
  const supabase = createAdminClient();

  // Fetch the doctor account
  const { data: doctorAccount, error: fetchError } = await supabase
    .from('doctor_accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !doctorAccount) {
    return NextResponse.json(
      { error: 'Doctor account not found.' },
      { status: 404 }
    );
  }

  if (doctorAccount.verification_status === 'verified') {
    return NextResponse.json(
      { error: 'Doctor is already verified.' },
      { status: 400 }
    );
  }

  // Update status to verified
  const { error: updateError } = await supabase
    .from('doctor_accounts')
    .update({
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
      rejection_reason: null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // If self-registered, create a matching doctors record
  if (doctorAccount.self_registered && !doctorAccount.doctor_id) {
    // Look up specialty_id from the Arabic name
    const { data: specialty } = await supabase
      .from('specialties')
      .select('id')
      .eq('name_ar', doctorAccount.specialty_ar)
      .single();

    const { data: newDoctor } = await supabase
      .from('doctors')
      .insert({
        name_ar: doctorAccount.name_ar,
        name_en: doctorAccount.name_en,
        specialty_id: specialty?.id,
        governorate_id: doctorAccount.governorate_id,
        clinic_address_ar: doctorAccount.clinic_name_ar,
        is_active: true,
        accepting_new_patients: true,
        available_for_booking: true,
      })
      .select('id')
      .single();

    if (newDoctor) {
      await supabase
        .from('doctor_accounts')
        .update({ doctor_id: newDoctor.id })
        .eq('id', id);
    }
  }

  return NextResponse.json({ success: true, message: 'Doctor verified successfully.' });
}

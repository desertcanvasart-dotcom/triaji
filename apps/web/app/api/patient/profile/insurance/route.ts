import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

// PUT /api/patient/profile/insurance — update patient insurance preference
export async function PUT(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as { insuranceProviderCode?: string };
  if (!body.insuranceProviderCode) {
    return NextResponse.json({ error: 'insuranceProviderCode is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('patient_profiles')
    .update({ insurance_provider_code: body.insuranceProviderCode })
    .eq('patient_id', patient.patientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

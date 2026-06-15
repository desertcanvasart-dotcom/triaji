import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

const supabase = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!
);

export async function POST(req: NextRequest) {
  try {
    // Resolve the patient from the signed patient-token cookie.
    // (patients has no auth_token column; the token is a verified JWT.)
    const patient = await getAuthenticatedPatient();
    if (!patient) {
      return NextResponse.json({ error: 'غير مسجل' }, { status: 401 });
    }

    const body = (await req.json()) as { expoPushToken?: string };
    const { expoPushToken } = body;

    if (!expoPushToken || typeof expoPushToken !== 'string') {
      return NextResponse.json({ error: 'expoPushToken مطلوب' }, { status: 400 });
    }

    await supabase
      .from('patients')
      .update({ expo_push_token: expoPushToken })
      .eq('id', patient.patientId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push-token] Error:', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

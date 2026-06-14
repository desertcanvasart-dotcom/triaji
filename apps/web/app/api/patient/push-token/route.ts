import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!
);

export async function POST(req: NextRequest) {
  try {
    const patientToken = req.cookies.get('patient-token')?.value;
    if (!patientToken) {
      return NextResponse.json({ error: 'غير مسجل' }, { status: 401 });
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_token', patientToken)
      .single();

    if (!patient) {
      return NextResponse.json({ error: 'مريض غير موجود' }, { status: 404 });
    }

    const body = (await req.json()) as { expoPushToken?: string };
    const { expoPushToken } = body;

    if (!expoPushToken || typeof expoPushToken !== 'string') {
      return NextResponse.json({ error: 'expoPushToken مطلوب' }, { status: 400 });
    }

    await supabase
      .from('patients')
      .update({ expo_push_token: expoPushToken })
      .eq('id', patient.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push-token] Error:', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

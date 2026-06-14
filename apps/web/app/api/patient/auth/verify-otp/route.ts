import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/auth/otp-store';
import { createServerClient } from '@triaji/shared/supabase';
import { createPatientToken } from '@/lib/auth/patient-token';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { phone?: string; otp?: string };

  if (!body.phone || !body.otp) {
    return NextResponse.json({ error: 'phone and otp are required' }, { status: 400 });
  }

  // Normalize phone
  let phone = body.phone.replace(/[\s\-]/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('20')) phone = '0' + phone.slice(2);

  const result = await verifyOTP(phone, body.otp);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // Find or create patient
  const supabase = createServerClient();
  let { data: patient } = await supabase
    .from('patients')
    .select('id, name_ar')
    .eq('phone_number', phone)
    .single();

  if (!patient) {
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({ phone_number: phone, name_ar: 'مريض', tenant_id: null })
      .select('id, name_ar')
      .single();
    if (error) {
      return NextResponse.json({ error: 'فشل في إنشاء حساب المريض' }, { status: 500 });
    }
    patient = newPatient;
  }

  // Generate token
  const token = createPatientToken(phone, patient!.id as string);

  const response = NextResponse.json({
    success: true,
    patientId: patient!.id,
    nameAr: patient!.name_ar,
  });

  // Set cookie for 30 days
  response.cookies.set('patient-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@/lib/sms/client';
import { storeOTP } from '@/lib/auth/otp-store';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { phone?: string };

  if (!body.phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  // Validate Egyptian phone format
  const cleaned = body.phone.replace(/[\s\-]/g, '');
  const phoneRegex = /^(01[0125]\d{8}|201[0125]\d{8}|\+201[0125]\d{8})$/;
  if (!phoneRegex.test(cleaned)) {
    return NextResponse.json({ error: 'رقم هاتف مصري غير صحيح' }, { status: 400 });
  }

  // Normalize to local format
  let normalizedPhone = cleaned;
  if (normalizedPhone.startsWith('+')) normalizedPhone = normalizedPhone.slice(1);
  if (normalizedPhone.startsWith('20')) normalizedPhone = '0' + normalizedPhone.slice(2);

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await storeOTP(normalizedPhone, otp);

  // Send OTP message
  const otpMessage = `رمز دكتور تريو: ${otp}. صالح لمدة 10 دقائق. لا تشاركه مع أحد.`;

  const waResult = await sendWhatsAppMessage(normalizedPhone, otpMessage);
  if (!waResult.success) {
    await sendSMS(normalizedPhone, otpMessage);
  }

  return NextResponse.json({ success: true, message: 'تم إرسال رمز التحقق' });
}

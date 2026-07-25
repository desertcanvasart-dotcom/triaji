import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@/lib/sms/client';
import { storeOTP } from '@/lib/auth/otp-store';
import { redis } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface ForgotPasswordBody {
  email?: string;
  locale?: 'ar' | 'en';
}

const RESEND_COOLDOWN_SECONDS = 60;

const T = {
  emailRequired: {
    ar: 'البريد الإلكتروني مطلوب',
    en: 'Email is required',
  },
  emailInvalid: {
    ar: 'البريد الإلكتروني مش صحيح',
    en: 'Invalid email address',
  },
  tooSoon: {
    ar: 'استنى دقيقة قبل ما تطلب رمز جديد',
    en: 'Please wait a minute before requesting a new code',
  },
  noPhone: {
    ar: 'الحساب ده مفيش عليه رقم موبايل. تواصل مع الدعم لاستعادة كلمة المرور.',
    en: 'This account has no phone number on file. Contact support to reset your password.',
  },
  unexpected: {
    ar: 'حدث خطأ غير متوقع',
    en: 'Something went wrong, please try again',
  },
} as const;

/** 01012345678 → 010****5678 */
function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ForgotPasswordBody;
    const locale = body.locale === 'en' ? 'en' : 'ar';
    const email = body.email?.trim().toLowerCase() ?? '';

    if (!email) {
      return NextResponse.json({ error: T.emailRequired[locale] }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: T.emailInvalid[locale] }, { status: 400 });
    }

    // Throttle resends per email so the OTP channel can't be hammered.
    const cooldownKey = `doctor-reset-cooldown:${email}`;
    if (await redis.get(cooldownKey)) {
      return NextResponse.json({ error: T.tooSoon[locale] }, { status: 429 });
    }
    await redis.set(cooldownKey, '1', { ex: RESEND_COOLDOWN_SECONDS });

    const supabase = getServiceClient();
    const { data: account } = await supabase
      .from('doctor_accounts')
      .select('id, phone')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    // Unknown email: answer exactly like the success case so the endpoint can't
    // be used to enumerate registered doctors.
    if (!account) {
      return NextResponse.json({ success: true, phone_hint: null });
    }

    const phone = (account.phone as string | null)?.trim();
    if (!phone) {
      return NextResponse.json({ error: T.noPhone[locale] }, { status: 400 });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await storeOTP(`doctor-reset:${phone}`, otp);

    const message =
      locale === 'en'
        ? `DoctorTrio password reset code: ${otp}. Valid for 10 minutes. Do not share it with anyone.`
        : `رمز استعادة كلمة المرور في دكتور تريو: ${otp}. صالح لمدة 10 دقائق. لا تشاركه مع أحد.`;

    const waResult = await sendWhatsAppMessage(phone, message);
    if (!waResult.success) {
      await sendSMS(phone, message);
    }

    return NextResponse.json({ success: true, phone_hint: maskPhone(phone) });
  } catch {
    return NextResponse.json({ error: T.unexpected.ar }, { status: 500 });
  }
}

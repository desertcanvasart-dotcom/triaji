import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@/lib/sms/client';
import { sendEmail } from '@triaji/shared/lib/email/client';
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
  unexpected: {
    ar: 'حدث خطأ غير متوقع',
    en: 'Something went wrong, please try again',
  },
} as const;

/** Password-reset code email, rendered in the doctor's locale. */
function resetEmailHtml(otp: string, locale: 'ar' | 'en'): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const copy =
    locale === 'en'
      ? {
          title: 'DoctorTrio',
          intro: 'We received a request to reset the password for your DoctorTrio doctor account.',
          code: 'Your verification code:',
          validity: 'The code is valid for 10 minutes. Do not share it with anyone.',
          ignore: "If you didn't request this, you can safely ignore this email.",
        }
      : {
          title: 'دكتور تريو',
          intro: 'وصلنا طلب لاستعادة كلمة المرور لحسابك كطبيب على دكتور تريو.',
          code: 'رمز التحقق بتاعك:',
          validity: 'الرمز صالح لمدة 10 دقائق. لا تشاركه مع أحد.',
          ignore: 'لو مش انت اللي طلبت ده، تجاهل الرسالة دي.',
        };
  return `<div dir="${dir}" style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A2F4A;line-height:1.7">
  <h2 style="color:#0d9488;margin:0 0 16px">${copy.title}</h2>
  <p>${copy.intro}</p>
  <p>${copy.code}</p>
  <p style="margin:20px 0;font-size:28px;font-weight:700;letter-spacing:6px;color:#0d9488">${otp}</p>
  <p>${copy.validity}</p>
  <p style="font-size:13px;color:#64748b">${copy.ignore}</p>
</div>`;
}

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

    // The code is keyed by account, not phone, so doctors without a mobile on
    // file can still reset by email.
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await storeOTP(`doctor-reset:${account.id as string}`, otp);

    // Always email the code — it's the channel the doctor typed in — and also
    // send it to the mobile on file when there is one.
    const emailResult = await sendEmail({
      to: email,
      subject:
        locale === 'en' ? 'Your DoctorTrio password reset code' : 'رمز استعادة كلمة المرور - دكتور تريو',
      html: resetEmailHtml(otp, locale),
    });
    if (!emailResult.success) {
      console.error('[doctor/forgot-password] reset email failed:', emailResult.error);
    }

    const phone = (account.phone as string | null)?.trim();
    if (phone) {
      const message =
        locale === 'en'
          ? `DoctorTrio password reset code: ${otp}. Valid for 10 minutes. Do not share it with anyone.`
          : `رمز استعادة كلمة المرور في دكتور تريو: ${otp}. صالح لمدة 10 دقائق. لا تشاركه مع أحد.`;

      const waResult = await sendWhatsAppMessage(phone, message);
      if (!waResult.success) {
        const smsResult = await sendSMS(phone, message);
        if (!smsResult.success) {
          console.error('[doctor/forgot-password] WhatsApp and SMS both failed for', maskPhone(phone));
        }
      }
    }

    return NextResponse.json({ success: true, phone_hint: phone ? maskPhone(phone) : null });
  } catch {
    return NextResponse.json({ error: T.unexpected.ar }, { status: 500 });
  }
}

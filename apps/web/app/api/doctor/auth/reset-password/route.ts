import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyOTP } from '@/lib/auth/otp-store';
import { redis } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface ResetPasswordBody {
  email?: string;
  otp?: string;
  password?: string;
  locale?: 'ar' | 'en';
}

const T = {
  missingFields: {
    ar: 'البريد الإلكتروني والرمز وكلمة المرور مطلوبين',
    en: 'Email, code and new password are required',
  },
  weakPassword: {
    ar: 'كلمة المرور لازم تكون 8 حروف على الأقل',
    en: 'Password must be at least 8 characters',
  },
  invalidCode: {
    ar: 'الرمز غير صحيح أو انتهت صلاحيته',
    en: 'The code is invalid or has expired',
  },
  updateFailed: {
    ar: 'حصلت مشكلة أثناء تغيير كلمة المرور، حاول تاني',
    en: 'Could not update the password, please try again',
  },
  unexpected: {
    ar: 'حدث خطأ غير متوقع',
    en: 'Something went wrong, please try again',
  },
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResetPasswordBody;
    const locale = body.locale === 'en' ? 'en' : 'ar';
    const email = body.email?.trim().toLowerCase() ?? '';
    const otp = body.otp?.trim() ?? '';
    const password = body.password ?? '';

    if (!email || !otp || !password) {
      return NextResponse.json({ error: T.missingFields[locale] }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: T.weakPassword[locale] }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: account } = await supabase
      .from('doctor_accounts')
      .select('id, phone')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    const phone = (account?.phone as string | null)?.trim();

    // Unknown email or missing phone gets the same answer as a wrong code —
    // the request step already refused to say whether the email is registered.
    if (!account || !phone) {
      return NextResponse.json({ error: T.invalidCode[locale] }, { status: 401 });
    }

    const result = await verifyOTP(`doctor-reset:${phone}`, otp);
    if (!result.valid) {
      return NextResponse.json(
        { error: locale === 'en' ? T.invalidCode.en : result.error ?? T.invalidCode.ar },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      account.id as string,
      { password }
    );

    if (updateError) {
      return NextResponse.json({ error: T.updateFailed[locale] }, { status: 500 });
    }

    // Let the doctor request a fresh code immediately if they need to reset again.
    await redis.del(`doctor-reset-cooldown:${email}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: T.unexpected.ar }, { status: 500 });
  }
}

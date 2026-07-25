import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@triaji/shared/lib/sms/client';
import { storeOTP } from '@triaji/shared/lib/auth/otp-store';
import { redis } from '@triaji/shared/lib/cache/redis';
import { createAdminClient, createAnonClient } from '@/lib/supabase/server';
import { findAdminByEmail } from '@/lib/auth/admin-lookup';

export const dynamic = 'force-dynamic';

interface ForgotPasswordBody {
  email?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

/** 01012345678 → 010****5678 */
function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ForgotPasswordBody;
    const email = body.email?.trim().toLowerCase() ?? '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    // Throttle resends per email so neither channel can be hammered.
    const cooldownKey = `admin-reset-cooldown:${email}`;
    if (await redis.get(cooldownKey)) {
      return NextResponse.json(
        { error: 'Please wait a minute before requesting another code.' },
        { status: 429 }
      );
    }
    await redis.set(cooldownKey, '1', { ex: RESEND_COOLDOWN_SECONDS });

    const supabase = createAdminClient();
    const admin = await findAdminByEmail(supabase, email);

    const phone =
      admin && admin.is_active ? (admin.phone as string | null)?.trim() || null : null;

    // With a mobile on file we can send the code over WhatsApp/SMS, which is
    // the channel this platform actually has configured.
    if (phone) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await storeOTP(`admin-reset:${phone}`, otp);

      const message = `DoctorTrio Admin password reset code: ${otp}. Valid for 10 minutes. Do not share it with anyone.`;
      const waResult = await sendWhatsAppMessage(phone, message);
      if (!waResult.success) {
        await sendSMS(phone, message);
      }

      return NextResponse.json({ success: true, channel: 'phone', phone_hint: maskPhone(phone) });
    }

    // No mobile on file — fall back to Supabase's email recovery link. An
    // unknown or deactivated email takes this branch too but sends nothing, so
    // the response can't be used to tell registered admins from strangers.
    if (admin && admin.is_active) {
      // /set-password already adopts Supabase invite/recovery hash tokens and
      // lets the user choose a password, so recovery links land there.
      const origin = request.nextUrl.origin;
      const anon = createAnonClient();
      const { error } = await anon.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/set-password`,
      });
      if (error) {
        console.error('[admin/forgot-password] recovery email failed:', error.message);
      }
    }

    return NextResponse.json({ success: true, channel: 'email' });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

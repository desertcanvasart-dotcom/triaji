import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@triaji/shared/lib/sms/client';
import { sendEmail } from '@triaji/shared/lib/email/client';
import { storeOTP } from '@triaji/shared/lib/auth/otp-store';
import { redis } from '@triaji/shared/lib/cache/redis';
import { createAdminClient } from '@/lib/supabase/server';
import { findAdminByEmail } from '@/lib/auth/admin-lookup';
import { getPublicOrigin } from '@/lib/public-origin';

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

/** Password-recovery email body (the admin panel is English-only). */
function recoveryEmailHtml(actionLink: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A2F4A;line-height:1.7">
  <h2 style="color:#0d9488;margin:0 0 16px">DoctorTrio Admin</h2>
  <p>We received a request to reset the password for your DoctorTrio admin account.</p>
  <p>Click the button below to choose a new password. This link can be used once and expires shortly.</p>
  <p style="margin:20px 0"><a href="${actionLink}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px">Reset password</a></p>
  <p style="font-size:13px;color:#64748b">If you didn't request this, you can safely ignore this email.</p>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8">This is an automated message from the DoctorTrio platform.</p>
</div>`;
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

    // No mobile on file — email a recovery link ourselves. We mint the link
    // with generateLink (which does NOT send) and deliver it through Resend, so
    // the mail comes from our verified domain instead of Supabase's built-in
    // mailer. An unknown or deactivated email takes this branch too but sends
    // nothing, so the response can't be used to tell registered admins from
    // strangers.
    if (admin && admin.is_active) {
      // /set-password already adopts Supabase invite/recovery hash tokens and
      // lets the user choose a password, so recovery links land there.
      const origin = getPublicOrigin(request);
      const { data: linkData, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${origin}/set-password` },
      });

      const actionLink = linkData?.properties?.action_link ?? null;
      if (error || !actionLink) {
        console.error(
          '[admin/forgot-password] recovery link generation failed:',
          error?.message ?? 'no action_link returned'
        );
      } else {
        const result = await sendEmail({
          to: email,
          subject: 'Reset your DoctorTrio Admin password',
          html: recoveryEmailHtml(actionLink),
        });
        if (!result.success) {
          console.error('[admin/forgot-password] recovery email failed:', result.error);
        }
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

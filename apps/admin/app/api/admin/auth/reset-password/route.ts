import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP, type OTPFailureReason } from '@triaji/shared/lib/auth/otp-store';
import { redis } from '@triaji/shared/lib/cache/redis';
import { createAdminClient } from '@/lib/supabase/server';
import { findAdminByEmail } from '@/lib/auth/admin-lookup';

export const dynamic = 'force-dynamic';

interface ResetPasswordBody {
  email?: string;
  otp?: string;
  password?: string;
}

/** The OTP store speaks Arabic; the admin panel is English-only. */
const OTP_ERRORS: Record<OTPFailureReason, string> = {
  not_found: 'That code has expired. Request a new one.',
  corrupt: 'That code could not be verified. Request a new one.',
  too_many_attempts: 'Too many incorrect attempts. Request a new code.',
  mismatch: 'That code is incorrect.',
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResetPasswordBody;
    const email = body.email?.trim().toLowerCase() ?? '';
    const otp = body.otp?.trim() ?? '';
    const password = body.password ?? '';

    if (!email || !otp || !password) {
      return NextResponse.json(
        { error: 'Email, code and new password are required.' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const admin = await findAdminByEmail(supabase, email);

    const phone =
      admin && admin.is_active ? (admin.phone as string | null)?.trim() || null : null;

    // Unknown, deactivated, or phone-less account answers like a bad code — the
    // request step already declined to say whether the email is registered.
    if (!phone) {
      return NextResponse.json({ error: OTP_ERRORS.not_found }, { status: 401 });
    }

    const result = await verifyOTP(`admin-reset:${phone}`, otp);
    if (!result.valid) {
      return NextResponse.json({ error: OTP_ERRORS[result.reason] }, { status: 401 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      admin!.id as string,
      { password }
    );

    if (updateError) {
      return NextResponse.json(
        { error: 'Could not update the password. Please try again.' },
        { status: 500 }
      );
    }

    // Let them request a fresh code immediately if they need to reset again.
    await redis.del(`admin-reset-cooldown:${email}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

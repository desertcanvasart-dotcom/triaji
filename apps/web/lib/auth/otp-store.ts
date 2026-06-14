/**
 * OTP Store — Redis-backed
 * Stores phone OTPs in Upstash Redis with automatic TTL expiration.
 * Max 3 failed attempts before invalidation.
 *
 * DEV_MODE: When Redis is not configured, falls back to in-memory mock
 * via the Redis client's built-in mock.
 */

import { redis } from '@/lib/cache/redis';

// ─── Configuration ──────────────────────────────────────────────────────────

const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;

// ─── Types ──────────────────────────────────────────────────────────────────

interface OTPEntry {
  code: string;
  attempts: number;
  createdAt: number;
}

// ─── Store OTP ──────────────────────────────────────────────────────────────

export async function storeOTP(phone: string, code: string): Promise<void> {
  const entry: OTPEntry = {
    code,
    attempts: 0,
    createdAt: Date.now(),
  };

  await redis.set(`otp:${phone}`, JSON.stringify(entry), { ex: OTP_TTL_SECONDS });
}

// ─── Verify OTP ─────────────────────────────────────────────────────────────

export async function verifyOTP(
  phone: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const raw = await redis.get<string>(`otp:${phone}`);

  if (!raw) {
    return { valid: false, error: 'لم يتم إرسال رمز لهذا الرقم' };
  }

  let entry: OTPEntry;
  try {
    entry = typeof raw === 'string' ? JSON.parse(raw) as OTPEntry : raw as unknown as OTPEntry;
  } catch {
    await redis.del(`otp:${phone}`);
    return { valid: false, error: 'خطأ في التحقق. اطلب رمز جديد.' };
  }

  // Check max attempts
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(`otp:${phone}`);
    return { valid: false, error: 'تجاوزت عدد المحاولات. اطلب رمز جديد.' };
  }

  // Check code match
  if (entry.code !== code) {
    entry.attempts++;

    // If this was the last allowed attempt, delete the OTP
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      await redis.del(`otp:${phone}`);
      return { valid: false, error: 'تجاوزت عدد المحاولات. اطلب رمز جديد.' };
    }

    // Update attempts count — keep same TTL
    const elapsed = Math.floor((Date.now() - entry.createdAt) / 1000);
    const remainingTtl = Math.max(OTP_TTL_SECONDS - elapsed, 1);
    await redis.set(`otp:${phone}`, JSON.stringify(entry), { ex: remainingTtl });

    return { valid: false, error: 'الرمز غير صحيح' };
  }

  // Success — delete the OTP
  await redis.del(`otp:${phone}`);
  return { valid: true };
}

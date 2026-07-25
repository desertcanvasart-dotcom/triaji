/**
 * OTP Store — Redis-backed
 * Stores phone OTPs in Upstash Redis with automatic TTL expiration.
 * Max 3 failed attempts before invalidation.
 *
 * DEV_MODE: When Redis is not configured, falls back to in-memory mock
 * via the Redis client's built-in mock.
 */

import { redis } from '../cache/redis';

// ─── Configuration ──────────────────────────────────────────────────────────

const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;

// ─── Types ──────────────────────────────────────────────────────────────────

interface OTPEntry {
  code: string;
  attempts: number;
  createdAt: number;
}

/** Why a verification failed. `error` carries the Arabic copy the patient and
 *  doctor flows render directly; English callers map off `reason` instead. */
export type OTPFailureReason = 'not_found' | 'corrupt' | 'too_many_attempts' | 'mismatch';

export type VerifyResult =
  | { valid: true; reason?: undefined; error?: undefined }
  | { valid: false; reason: OTPFailureReason; error: string };

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
): Promise<VerifyResult> {
  const raw = await redis.get<string>(`otp:${phone}`);

  if (!raw) {
    return { valid: false, reason: 'not_found', error: 'لم يتم إرسال رمز لهذا الرقم' };
  }

  let entry: OTPEntry;
  try {
    entry = typeof raw === 'string' ? JSON.parse(raw) as OTPEntry : raw as unknown as OTPEntry;
  } catch {
    await redis.del(`otp:${phone}`);
    return { valid: false, reason: 'corrupt', error: 'خطأ في التحقق. اطلب رمز جديد.' };
  }

  // Check max attempts
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(`otp:${phone}`);
    return { valid: false, reason: 'too_many_attempts', error: 'تجاوزت عدد المحاولات. اطلب رمز جديد.' };
  }

  // Check code match
  if (entry.code !== code) {
    entry.attempts++;

    // If this was the last allowed attempt, delete the OTP
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      await redis.del(`otp:${phone}`);
      return { valid: false, reason: 'too_many_attempts', error: 'تجاوزت عدد المحاولات. اطلب رمز جديد.' };
    }

    // Update attempts count — keep same TTL
    const elapsed = Math.floor((Date.now() - entry.createdAt) / 1000);
    const remainingTtl = Math.max(OTP_TTL_SECONDS - elapsed, 1);
    await redis.set(`otp:${phone}`, JSON.stringify(entry), { ex: remainingTtl });

    return { valid: false, reason: 'mismatch', error: 'الرمز غير صحيح' };
  }

  // Success — delete the OTP
  await redis.del(`otp:${phone}`);
  return { valid: true };
}

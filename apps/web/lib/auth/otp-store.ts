/**
 * Re-export of the shared OTP store.
 * The implementation moved to `@triaji/shared` so the admin panel's password
 * reset can share one store; this shim keeps `@/lib/auth/otp-store` imports working.
 */

export {
  storeOTP,
  verifyOTP,
  type OTPFailureReason,
  type VerifyResult,
} from '@triaji/shared/lib/auth/otp-store';

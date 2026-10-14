/**
 * Waiting-room display links.
 *
 * A clinic TV shows the doctor's queue without anyone signing in, so its URL
 * carries a token: `<doctorId>.<hmac>` signed with a server secret. The token
 * can't be forged for another doctor and reveals nothing beyond the doctor id.
 * Setting DISPLAY_TOKEN_SECRET (falls back to the service-role key) and
 * changing it invalidates every display link.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const value = process.env['DISPLAY_TOKEN_SECRET'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!value) throw new Error('DISPLAY_TOKEN_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set');
  return value;
}

function signature(doctorId: string): string {
  return createHmac('sha256', secret()).update(`display:${doctorId}`).digest('base64url').slice(0, 22);
}

export function createDisplayToken(doctorId: string): string {
  return `${doctorId}.${signature(doctorId)}`;
}

/** The doctor id a token was issued for, or null when it doesn't verify. */
export function verifyDisplayToken(token: string): string | null {
  const [doctorId, sig] = token.split('.');
  if (!doctorId || !sig || !UUID_RE.test(doctorId)) return null;
  const expected = Buffer.from(signature(doctorId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return doctorId;
}

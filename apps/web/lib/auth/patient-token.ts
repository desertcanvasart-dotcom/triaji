/**
 * Patient authentication token utilities.
 * Uses HMAC-SHA256 signing with Node's built-in crypto module.
 * No external JWT dependency needed.
 */

import { createHmac } from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-secret-key';

interface TokenPayload {
  phone: string;
  patientId: string;
  exp: number;
}

export function createPatientToken(phone: string, patientId: string): string {
  const payload: TokenPayload = {
    phone,
    patientId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyPatientToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, sig] = parts as [string, string];
  const expectedSig = createHmac('sha256', SECRET).update(data).digest('base64url');

  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as TokenPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

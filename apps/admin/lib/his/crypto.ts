/**
 * HIS Credential Encryption
 *
 * Uses AES-256-GCM for encrypting HIS credentials before storage.
 * Encryption key from HIS_ENCRYPTION_KEY env var (32-byte hex string).
 *
 * NEVER log decrypted credentials. NEVER return them in API responses.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env['HIS_ENCRYPTION_KEY'];
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'HIS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt credentials object.
 * @returns base64-encoded string: iv (16 bytes) + authTag (16 bytes) + ciphertext
 */
export function encryptCredentials(credentials: Record<string, unknown>): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const plaintext = JSON.stringify(credentials);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt credentials string back to object.
 */
export function decryptCredentials(encrypted: string): Record<string, unknown> {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>;
}

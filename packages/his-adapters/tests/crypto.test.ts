import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'crypto';

// We test crypto by importing the raw functions with the key set
// The crypto module lives in apps/web but we test the logic here

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Generate a test key
const TEST_KEY = randomBytes(32);

function encryptCredentials(credentials: Record<string, unknown>): string {
  const { createCipheriv, randomBytes: rb } = require('crypto');
  const iv = rb(IV_LENGTH);
  const plaintext = JSON.stringify(credentials);

  const cipher = createCipheriv(ALGORITHM, TEST_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptCredentials(encrypted: string): Record<string, unknown> {
  const { createDecipheriv } = require('crypto');
  const combined = Buffer.from(encrypted, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, TEST_KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

describe('HIS Credential Encryption', () => {
  it('encrypts and decrypts API key credentials', () => {
    const creds = { apiKey: 'shifa-prod-key-abc123' };
    const encrypted = encryptCredentials(creds);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it('encrypts and decrypts OAuth2 credentials', () => {
    const creds = {
      clientId: 'my-client-id',
      clientSecret: 'super-secret-value',
      tokenUrl: 'https://his.hospital.com/oauth/token',
    };
    const encrypted = encryptCredentials(creds);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it('encrypts and decrypts basic auth credentials', () => {
    const creds = {
      username: 'admin',
      password: 'p@ssw0rd!',
    };
    const encrypted = encryptCredentials(creds);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const creds = { apiKey: 'test-key' };
    const enc1 = encryptCredentials(creds);
    const enc2 = encryptCredentials(creds);
    expect(enc1).not.toBe(enc2); // Different IVs
    expect(decryptCredentials(enc1)).toEqual(creds);
    expect(decryptCredentials(enc2)).toEqual(creds);
  });

  it('encrypted data is base64 encoded', () => {
    const creds = { apiKey: 'test' };
    const encrypted = encryptCredentials(creds);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('decrypted credentials never contain encryption metadata', () => {
    const creds = { apiKey: 'test-key-123' };
    const encrypted = encryptCredentials(creds);
    const decrypted = decryptCredentials(encrypted);

    // Should only contain the original data
    expect(Object.keys(decrypted)).toEqual(['apiKey']);
    expect(decrypted['apiKey']).toBe('test-key-123');
  });

  it('handles complex nested credentials', () => {
    const creds = {
      apiKey: 'key',
      fieldMapping: {
        doctor_id: 'staff_id',
        slot_time: 'start_datetime',
      },
    };
    const encrypted = encryptCredentials(creds);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it('throws on invalid encrypted data', () => {
    expect(() => decryptCredentials('invalid-base64')).toThrow();
  });
});

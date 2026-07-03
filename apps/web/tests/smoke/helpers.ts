/**
 * Smoke-suite helpers.
 *
 * These tests exercise the REAL app (dev server or a deployed host) against
 * the REAL Supabase — they are integration smoke tests, not unit tests.
 *
 * Prerequisites:
 *   - repo-root .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *     (or those variables already in the environment, e.g. in CI)
 *   - the web app running (default http://localhost:3000; override with SMOKE_BASE_URL)
 *
 * Run: pnpm test:smoke
 */

import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Env ─────────────────────────────────────────────────────────────────────

function loadRootEnvLocal(): void {
  // vitest runs with cwd = apps/web; the shared secrets live at the repo root.
  const envPath = resolve(process.cwd(), '../../.env.local');
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    return; // fine — variables may already be in the environment (CI)
  }
  for (const line of raw.split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && m[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

loadRootEnvLocal();

export const BASE_URL = process.env['SMOKE_BASE_URL'] ?? 'http://localhost:3000';
export const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
export const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    'Smoke suite needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
      '(repo-root .env.local or environment).'
  );
}

// ─── Supabase REST (service role) ────────────────────────────────────────────

export const serviceHeaders: Record<string, string> = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

/** Query the live PostgREST API with the service key. */
export async function rest<T>(pathAndQuery: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${pathAndQuery}`, {
    ...init,
    headers: { ...serviceHeaders, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    throw new Error(`REST ${pathAndQuery} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (res.status === 204 ? (undefined as T) : ((await res.json()) as T));
}

// ─── App auth ────────────────────────────────────────────────────────────────

/** Mint a patient-token cookie value (mirrors lib/auth/patient-token.ts). */
export function mintPatientToken(phone: string, patientId: string): string {
  const data = Buffer.from(
    JSON.stringify({ phone, patientId, exp: Date.now() + 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = createHmac('sha256', SERVICE_KEY).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Fetch an app route, optionally as an authenticated patient. */
export function app(path: string, opts?: { patientToken?: string; redirect?: RequestRedirect }) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: opts?.redirect ?? 'manual',
    headers: opts?.patientToken ? { Cookie: `patient-token=${opts.patientToken}` } : undefined,
  });
}

/** Throw a clear error if the app server isn't reachable. */
export async function ensureServerUp(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/health`);
  } catch {
    throw new Error(
      `Web app not reachable at ${BASE_URL}. Start it (pnpm dev) or set SMOKE_BASE_URL.`
    );
  }
}

/** First patient in the live DB — smoke tests piggyback on existing data. */
export async function anyPatient(): Promise<{ id: string; phone_number: string }> {
  const rows = await rest<{ id: string; phone_number: string }[]>(
    '/patients?select=id,phone_number&limit=1'
  );
  if (!rows[0]) throw new Error('No patients in the live DB — smoke suite needs at least one.');
  return rows[0];
}

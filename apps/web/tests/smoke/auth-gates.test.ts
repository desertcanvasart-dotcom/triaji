/**
 * Auth-gate smoke tests: PII-bearing routes must reject anonymous callers.
 * Every route here uses the service-role Supabase client internally, so the
 * ONLY protection is its own auth check — exactly the bug class behind the
 * 2026-07 IDOR fixes (booking, telehealth token, patient history).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { app, ensureServerUp } from './helpers';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

beforeAll(async () => {
  await ensureServerUp();
});

describe('anonymous requests are rejected', () => {
  it('GET /api/health is public and answers', async () => {
    const res = await app('/api/health');
    expect([200, 503]).toContain(res.status);
    const body = (await res.json()) as { ok: boolean; checks: Record<string, string> };
    expect(body.checks).toBeDefined();
  });

  it('GET /api/patient/history → 401', async () => {
    expect((await app('/api/patient/history')).status).toBe(401);
  });

  it('GET /api/patient/medical-record/timeline → 401', async () => {
    expect((await app('/api/patient/medical-record/timeline')).status).toBe(401);
  });

  it('GET /api/booking/[id] → 401', async () => {
    expect((await app(`/api/booking/${NIL_UUID}`)).status).toBe(401);
  });

  it('GET /api/clinical-document/[id]/pdf (unknown id) → 404, never a signed URL', async () => {
    const res = await app(`/api/clinical-document/${NIL_UUID}/pdf`);
    expect(res.status).toBe(404);
  });

  it('GET /api/doctor/patients → 401', async () => {
    expect((await app('/api/doctor/patients')).status).toBe(401);
  });

  it('GET /api/admin/bookings/[id]/patient-history → 401', async () => {
    expect((await app(`/api/admin/bookings/${NIL_UUID}/patient-history`)).status).toBe(401);
  });

  it('GET /api/telehealth/token without params → 400', async () => {
    expect((await app('/api/telehealth/token')).status).toBe(400);
  });
});

/**
 * Authenticated patient-flow smoke tests: mint a real patient session (HMAC
 * token, no OTP needed) and hit the read endpoints the patient home screen
 * depends on. Catches schema drift and response-shape regressions that
 * typecheck can't see.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { app, ensureServerUp, anyPatient, mintPatientToken } from './helpers';

let patientToken: string;

beforeAll(async () => {
  await ensureServerUp();
  const patient = await anyPatient();
  patientToken = mintPatientToken(patient.phone_number, patient.id);
});

describe('patient read endpoints', () => {
  it('GET /api/patient/history → 200 with summaries + clinical_documents', async () => {
    const res = await app('/api/patient/history', { patientToken });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summaries: unknown[]; clinical_documents: unknown[] };
    expect(Array.isArray(body.summaries)).toBe(true);
    expect(Array.isArray(body.clinical_documents)).toBe(true);
  });

  it('GET /api/patient/medical-record/timeline → 200', async () => {
    const res = await app('/api/patient/medical-record/timeline', { patientToken });
    expect(res.status).toBe(200);
  });

  it('a forged patient token is rejected', async () => {
    const [data] = patientToken.split('.');
    const res = await app('/api/patient/history', { patientToken: `${data}.forged-signature` });
    expect(res.status).toBe(401);
  });
});

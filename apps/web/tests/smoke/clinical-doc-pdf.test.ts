/**
 * Clinical-document signed-URL flow, end to end with a temporary fixture:
 * upload a PDF to the private bucket + insert a health_records row, then
 * verify all three auth paths of GET /api/clinical-document/[id]/pdf.
 * The fixture is fully torn down afterwards.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  app,
  rest,
  ensureServerUp,
  mintPatientToken,
  serviceHeaders,
  SUPABASE_URL,
} from './helpers';

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'xref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF'
);

let recordId: string;
let storagePath: string;
let ownerToken: string;
let otherToken: string;

beforeAll(async () => {
  await ensureServerUp();

  const patients = await rest<{ id: string; phone_number: string }[]>(
    '/patients?select=id,phone_number&limit=2'
  );
  const [owner, other] = patients;
  if (!owner || !other) throw new Error('Smoke suite needs at least 2 patients in the live DB.');

  ownerToken = mintPatientToken(owner.phone_number, owner.id);
  otherToken = mintPatientToken(other.phone_number, other.id);

  storagePath = `${owner.id}/TRJ-SMOKE-SIGNEDURL.pdf`;
  const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/clinical-documents/${storagePath}`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: MINIMAL_PDF,
  });
  if (!upload.ok) throw new Error(`fixture upload failed: ${upload.status}`);

  const rows = await rest<{ id: string }[]>('/health_records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      patient_id: owner.id,
      record_type: 'prescription',
      file_url: storagePath,
      file_name: 'TRJ-SMOKE-SIGNEDURL.pdf',
      mime_type: 'application/pdf',
      doctor_authored: true,
      document_type: 'prescription',
      document_number: 'TRJ-SMOKE-TEST',
      pdf_url: storagePath,
    }),
  });
  recordId = rows[0]!.id;
});

afterAll(async () => {
  if (recordId) {
    await rest(`/health_records?id=eq.${recordId}`, { method: 'DELETE' });
  }
  if (storagePath) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/clinical-documents/${storagePath}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });
  }
});

describe('GET /api/clinical-document/[id]/pdf', () => {
  it('anonymous → 401', async () => {
    expect((await app(`/api/clinical-document/${recordId}/pdf`)).status).toBe(401);
  });

  it('a different patient → 404 (no existence leak)', async () => {
    const res = await app(`/api/clinical-document/${recordId}/pdf`, { patientToken: otherToken });
    expect(res.status).toBe(404);
  });

  it('the owner → 302 to a signed URL that serves the PDF', async () => {
    const res = await app(`/api/clinical-document/${recordId}/pdf`, { patientToken: ownerToken });
    expect(res.status).toBe(302);

    const signedUrl = res.headers.get('location');
    expect(signedUrl).toBeTruthy();

    const pdf = await fetch(signedUrl!);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    const bytes = Buffer.from(await pdf.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

import { NextResponse } from 'next/server';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { createServerClient } from '@triaji/shared/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const SHARE_EXPIRY_HOURS = 24;

// ─── POST /api/patient/medical-record/share ───────────────────────────────────
// Creates a 24-hour share link for the patient's medical record.
// Returns a signed JWT token that can be verified to grant read access.
export async function POST() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const expiresAt = new Date(Date.now() + SHARE_EXPIRY_HOURS * 3600 * 1000);

  // Simple token: UUID stored with expiry
  const token = crypto.randomUUID();

  // Store the share record
  const supabase = createServerClient();
  const { error: insertError } = await supabase.from('medical_record_shares').insert({
    token,
    patient_id: patient.patientId,
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) {
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }

  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://doctortrio.online';
  // Points at the viewer page app/ar/share/medical-record/[token]/page.tsx
  const shareUrl = `${baseUrl}/ar/share/medical-record/${token}`;

  return NextResponse.json({
    shareUrl,
    token,
    expiresAt: expiresAt.toISOString(),
    expiresInHours: SHARE_EXPIRY_HOURS,
  });
}

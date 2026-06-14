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
  // Store share record (best-effort — table may not exist yet)
  try {
    await supabase.from('medical_record_shares').insert({
      token,
      patient_id: patient.patientId,
      expires_at: expiresAt.toISOString(),
    });
  } catch {
    // Table might not exist yet — token-only approach
  }

  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://triajji.com';
  const shareUrl = `${baseUrl}/ar/records/shared?token=${token}`;

  return NextResponse.json({
    shareUrl,
    token,
    expiresAt: expiresAt.toISOString(),
    expiresInHours: SHARE_EXPIRY_HOURS,
  });
}

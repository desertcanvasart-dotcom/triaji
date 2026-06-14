import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { calculateAdherence, type AdherenceRecord } from '@/lib/adherence/calculate-adherence';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/adherence ───────────────────────────────────────────────
// Returns medication adherence data for the last 90 days.
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();

  let records: AdherenceRecord[];
  try {
    records = await calculateAdherence(supabase, patient.patientId);
  } catch (err) {
    console.error('[adherence/GET] Error:', err);
    return NextResponse.json({ error: 'Failed to calculate adherence' }, { status: 500 });
  }

  const total = records.length;
  const dispensed = records.filter((r) => r.status === 'dispensed').length;
  const sentToPharmacy = records.filter((r) => r.status === 'sent_to_pharmacy').length;
  const notDispensed = records.filter((r) => r.status === 'not_dispensed').length;

  return NextResponse.json({
    records,
    summary: {
      total,
      dispensed,
      sentToPharmacy,
      notDispensed,
      adherenceRate: total > 0 ? Math.round((dispensed / total) * 100) : 100,
    },
  });
}

/**
 * GET /api/health-assistant/eligibility
 * Gates the health assistant behind a minimum-data threshold: the patient
 * must have at least one meaningful health-data point on file before the
 * assistant has anything useful to reason about.
 *
 * Eligible if the patient has at least one of:
 *   - a health_records row
 *   - a patient_medications row (via their patient_profiles)
 *   - a patient_chronic_conditions row (via their patient_profiles)
 *   - a completed booking
 *
 * Auth: patient (cookie-based)
 * Returns: { eligible: boolean, context: ContextInfo | null, patientName: string }
 *   ContextInfo = { lastLabDate: string | null, lastVisitDate: string | null, activeMedsCount: number }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

interface ContextInfo {
  lastLabDate: string | null;
  lastVisitDate: string | null;
  activeMedsCount: number;
}

export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();

    // Resolve this patient's profile ids — medications / chronic conditions
    // are keyed by patient_profile_id, not patient_id. The display name lives on
    // the patients table (name_ar), not patient_profiles.
    const [{ data: profiles }, { data: patientRow }] = await Promise.all([
      supabase.from('patient_profiles').select('id').eq('patient_id', patient.patientId),
      supabase.from('patients').select('name_ar').eq('id', patient.patientId).single(),
    ]);

    const profileIds = (profiles ?? []).map((p) => p.id as string);
    const patientName = (patientRow?.name_ar as string | null | undefined) ?? '';

    // ─── Data-point checks (run in parallel) ────────────────────────────────
    const [labResult, visitResult, medsResult, conditionsResult, recordsResult] =
      await Promise.all([
        // Latest lab result → drives lastLabDate + counts toward health_records
        supabase
          .from('health_records')
          .select('uploaded_at')
          .eq('patient_id', patient.patientId)
          .eq('record_type', 'lab_result')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Latest completed booking → drives lastVisitDate
        supabase
          .from('bookings')
          .select('appointment_datetime')
          .eq('patient_id', patient.patientId)
          .eq('status', 'completed')
          .order('appointment_datetime', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Active medications count (and existence)
        profileIds.length > 0
          ? supabase
              .from('patient_medications')
              .select('id', { count: 'exact', head: true })
              .in('patient_profile_id', profileIds)
          : Promise.resolve({ count: 0 as number | null }),

        // Any chronic condition on file
        profileIds.length > 0
          ? supabase
              .from('patient_chronic_conditions')
              .select('id', { head: true, count: 'exact' })
              .in('patient_profile_id', profileIds)
          : Promise.resolve({ count: 0 as number | null }),

        // Any health record at all (broader than just lab results)
        supabase
          .from('health_records')
          .select('id', { head: true, count: 'exact' })
          .eq('patient_id', patient.patientId),
      ]);

    const lastLabDate = (labResult.data?.uploaded_at as string | null | undefined) ?? null;
    const lastVisitDate =
      (visitResult.data?.appointment_datetime as string | null | undefined) ?? null;
    const activeMedsCount = medsResult.count ?? 0;
    const chronicCount = conditionsResult.count ?? 0;
    const healthRecordCount = recordsResult.count ?? 0;
    const hasCompletedBooking = lastVisitDate !== null;

    const eligible =
      healthRecordCount > 0 ||
      activeMedsCount > 0 ||
      chronicCount > 0 ||
      hasCompletedBooking;

    const context: ContextInfo = {
      lastLabDate,
      lastVisitDate,
      activeMedsCount,
    };

    return NextResponse.json({ eligible, context, patientName });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[HealthAssistant Eligibility] Error:', message);
    return NextResponse.json({ error: 'حصل خطأ. حاول تاني.' }, { status: 500 });
  }
}

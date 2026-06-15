import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── GET /api/patient/referrals ──────────────────────────────────────────────
// Returns all referrals for the authenticated patient with doctor names joined.

export async function GET() {
  try {
    const patient = await getAuthenticatedPatient();
    if (!patient) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const supabase = getServiceClient();

    const { data: referrals, error } = await supabase
      .from('referrals')
      .select(`
        id,
        status,
        tier,
        urgency,
        reason_ar,
        reason_en,
        clinical_summary_ar,
        clinical_summary_en,
        outcome_summary_ar,
        sent_at,
        accepted_at,
        declined_at,
        outcome_reported_at,
        created_at,
        referring_doctor:referring_doctor_id (
          id,
          name_ar,
          name_en,
          specialties:specialty_id ( name_ar, name_en )
        ),
        referred_doctor:referred_doctor_id (
          id,
          name_ar,
          name_en,
          specialties:specialty_id ( name_ar, name_en )
        ),
        specialty:referred_specialty_id (
          id,
          name_ar,
          name_en
        )
      `)
      .eq('patient_id', patient.patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[patient/referrals/GET] Query error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
    }

    return NextResponse.json({ referrals: referrals ?? [] });
  } catch (err) {
    console.error('[patient/referrals/GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/insurance/status?policy_id=xxx ────────────────────────
// Check verification status for a policy
export async function GET(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const policyId = request.nextUrl.searchParams.get('policy_id');
  if (!policyId) {
    return NextResponse.json(
      { error: 'policy_id query parameter is required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: policy, error } = await supabase
    .from('patient_insurance_policies')
    .select(`
      id,
      insurer_code,
      policy_number,
      status,
      last_verified_at,
      annual_limit_egp,
      used_limit_egp,
      remaining_limit_egp,
      copay_pct,
      coverage_start,
      coverage_end,
      is_primary
    `)
    .eq('id', policyId)
    .eq('patient_id', patient.patientId)
    .eq('is_active', true)
    .single();

  if (error || !policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  // Enrich with insurer info
  const { data: insurer } = await supabase
    .from('insurance_providers')
    .select('code, name_ar, name_en, logo_url')
    .eq('code', policy.insurer_code)
    .single();

  return NextResponse.json({
    policy: {
      ...policy,
      insurer: insurer ?? null,
    },
  });
}

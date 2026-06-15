import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/insurance/policy ──────────────────────────────────────
// List patient's insurance policies
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: policies, error } = await supabase
    .from('patient_insurance_policies')
    .select(`
      id,
      insurer_code,
      policy_number,
      card_number,
      member_name_ar,
      employer_ar,
      coverage_start,
      coverage_end,
      annual_limit_egp,
      used_limit_egp,
      remaining_limit_egp,
      copay_pct,
      status,
      last_verified_at,
      card_image_url,
      is_primary,
      is_active,
      created_at
    `)
    .eq('patient_id', patient.patientId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with insurer names
  const insurerCodes = [...new Set(policies.map((p) => p.insurer_code))];
  const { data: insurers } = await supabase
    .from('insurance_providers')
    .select('code, name_ar, name_en, logo_url')
    .in('code', insurerCodes);

  const insurerMap = new Map(insurers?.map((i) => [i.code, i]) ?? []);

  const enriched = policies.map((p) => ({
    ...p,
    insurer: insurerMap.get(p.insurer_code) ?? null,
  }));

  return NextResponse.json({ policies: enriched });
}

// ─── POST /api/patient/insurance/policy ─────────────────────────────────────
// Save new insurance policy
export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.insurer_code || !body.policy_number) {
    return NextResponse.json(
      { error: 'insurer_code and policy_number are required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Verify insurer_code exists
  const { data: insurer, error: insurerError } = await supabase
    .from('insurance_providers')
    .select('code, name_ar, name_en')
    .eq('code', body.insurer_code)
    .eq('is_active', true)
    .single();

  if (insurerError || !insurer) {
    return NextResponse.json({ error: 'Invalid insurer_code' }, { status: 400 });
  }

  // Check for duplicate policy
  const { data: existing } = await supabase
    .from('patient_insurance_policies')
    .select('id')
    .eq('patient_id', patient.patientId)
    .eq('insurer_code', body.insurer_code)
    .eq('policy_number', body.policy_number)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'This policy already exists for your account' },
      { status: 409 }
    );
  }

  // Determine if this should be primary (first policy = primary)
  const { count } = await supabase
    .from('patient_insurance_policies')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patient.patientId)
    .eq('is_active', true);

  const isPrimary = (count ?? 0) === 0;

  // Look up insurer tenant for routing. The insurer↔tenant mapping lives on
  // tenant_config.insurer_code (there is no tenants.insurance_provider_code column).
  const { data: insurerConfig } = await supabase
    .from('tenant_config')
    .select('tenant_id')
    .eq('insurer_code', body.insurer_code)
    .maybeSingle();

  const { data: policy, error } = await supabase
    .from('patient_insurance_policies')
    .insert({
      patient_id: patient.patientId,
      insurer_code: body.insurer_code,
      insurer_tenant_id: insurerConfig?.tenant_id ?? null,
      policy_number: body.policy_number,
      card_number: body.card_number ?? null,
      member_name_ar: body.member_name_ar ?? null,
      employer_ar: body.employer_ar ?? null,
      card_image_url: body.card_image_url ?? null,
      status: 'unverified',
      is_primary: isPrimary,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policy }, { status: 201 });
}

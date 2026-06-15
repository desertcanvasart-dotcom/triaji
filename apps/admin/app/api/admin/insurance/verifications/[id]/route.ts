import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireInsuranceAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── PUT /api/admin/insurance/verifications/[id] ────────────────────────────
// Insurer verifies a patient's insurance policy.
// Auth: insurance_reviewer or platform_admin.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  const insuranceCheck = requireInsuranceAccess(admin);
  if (insuranceCheck) return insuranceCheck;

  const { id } = await params;
  const supabase = createAdminClient();

  const body = await request.json();

  // Validate required fields
  if (!body.status || !['active', 'expired', 'suspended'].includes(body.status)) {
    return NextResponse.json(
      { error: "status is required and must be one of: 'active', 'expired', 'suspended'" },
      { status: 400 }
    );
  }

  // Fetch existing policy
  const { data: existing, error: fetchError } = await supabase
    .from('patient_insurance_policies')
    .select('id, status, patient_id, insurer_code, policy_number')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  if (existing.status !== 'pending_verification') {
    return NextResponse.json(
      { error: `Cannot verify policy with status '${existing.status}'. Must be 'pending_verification'.` },
      { status: 400 }
    );
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    status: body.status,
    last_verified_at: new Date().toISOString(),
    verified_by: admin.id,
    updated_at: new Date().toISOString(),
  };

  if (body.annual_limit_egp !== undefined) updateData.annual_limit_egp = body.annual_limit_egp;
  if (body.copay_pct !== undefined) updateData.copay_pct = body.copay_pct;
  if (body.coverage_end !== undefined) updateData.coverage_end = body.coverage_end;

  const { data: policy, error } = await supabase
    .from('patient_insurance_policies')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send WhatsApp notification to patient (fire-and-forget)
  try {
    const { data: patient } = await supabase
      .from('patients')
      .select('phone_number, patient_profiles(preferred_language)')
      .eq('id', existing.patient_id)
      .single();

    const { data: insurer } = await supabase
      .from('insurance_providers')
      .select('name_ar, name_en')
      .eq('code', existing.insurer_code)
      .single();

    if (patient?.phone_number && insurer) {
      const patientLang =
        (patient.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
          ?.preferred_language ?? 'ar';
      // Dynamic import to avoid cross-app dependency issues
      const whatsappUrl = process.env['WEB_APP_URL'] ?? process.env['NEXT_PUBLIC_WEB_URL'];
      if (whatsappUrl) {
        fetch(`${whatsappUrl}/api/internal/insurance-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env['INTERNAL_API_SECRET'] ?? '' },
          body: JSON.stringify({
            type: 'policy_verified',
            phone: patient.phone_number,
            lang: patientLang,
            data: {
              insurerNameAr: insurer.name_ar,
              insurerNameEn: insurer.name_en,
              policyNumber: existing.policy_number,
              status: body.status,
              annualLimitEgp: body.annual_limit_egp,
              copayPct: body.copay_pct,
              coverageEnd: body.coverage_end,
            },
          }),
        }).catch((err) => {
          console.error('[Verification] WhatsApp notification failed:', err);
        });
      }
    }
  } catch (notifErr) {
    console.error('[Verification] Notification error:', notifErr);
  }

  return NextResponse.json({ policy });
}

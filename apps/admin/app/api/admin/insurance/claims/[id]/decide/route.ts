import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireInsuranceAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── PUT /api/admin/insurance/claims/[id]/decide ────────────────────────────
// Claim decision by insurer.
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

  // Validate decision
  const validDecisions = ['approved', 'approved_partial', 'rejected'];
  if (!body.decision || !validDecisions.includes(body.decision)) {
    return NextResponse.json(
      { error: "decision is required and must be one of: 'approved', 'approved_partial', 'rejected'" },
      { status: 400 }
    );
  }

  // Fetch existing claim
  const { data: existing, error: fetchError } = await supabase
    .from('insurance_claims')
    .select(`
      id, status, claim_number, total_amount_egp, claimed_amount_egp,
      patient_id, policy_id, insurer_code, provider_tenant_id
    `)
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  if (!['submitted', 'under_review', 'appealed'].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot decide on claim with status '${existing.status}'.` },
      { status: 400 }
    );
  }

  // Compute provider_receives_egp
  const isApproved = body.decision === 'approved' || body.decision === 'approved_partial';
  let approvedAmount = isApproved ? (body.approved_amount_egp ?? existing.claimed_amount_egp) : 0;
  let patientCopay = body.patient_copay_egp ?? 0;
  let providerReceives = isApproved ? Number(approvedAmount) - Number(patientCopay) : 0;

  // Ensure provider_receives is not negative
  if (providerReceives < 0) providerReceives = 0;

  // Build update
  const updateData: Record<string, unknown> = {
    status: body.decision,
    reviewed_at: new Date().toISOString(),
    reviewed_by: admin.id,
    approved_amount_egp: isApproved ? approvedAmount : null,
    patient_copay_egp: isApproved ? patientCopay : null,
    provider_receives_egp: isApproved ? providerReceives : null,
    updated_at: new Date().toISOString(),
  };

  if (body.rejection_reason_ar !== undefined) updateData.rejection_reason_ar = body.rejection_reason_ar;
  if (body.rejection_code !== undefined) updateData.rejection_code = body.rejection_code;
  if (body.decision === 'approved_partial' && body.partial_approval_notes_ar) {
    updateData.partial_approval_notes_ar = body.partial_approval_notes_ar;
  }

  const { data: claim, error } = await supabase
    .from('insurance_claims')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update used_limit_egp on the policy if approved
  if (isApproved && approvedAmount > 0) {
    const { data: policy } = await supabase
      .from('patient_insurance_policies')
      .select('used_limit_egp')
      .eq('id', existing.policy_id)
      .single();

    if (policy) {
      await supabase
        .from('patient_insurance_policies')
        .update({
          used_limit_egp: Number(policy.used_limit_egp ?? 0) + Number(approvedAmount),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.policy_id);
    }
  }

  // Send notification to provider (fire-and-forget)
  try {
    const { data: providerTenant } = await supabase
      .from('tenants')
      .select('phone, name_ar')
      .eq('id', existing.provider_tenant_id)
      .single();

    const { data: patient } = await supabase
      .from('patients')
      .select('name_ar')
      .eq('id', existing.patient_id)
      .single();

    if (providerTenant?.phone && patient) {
      const whatsappUrl = process.env['WEB_APP_URL'] ?? process.env['NEXT_PUBLIC_WEB_URL'];
      if (whatsappUrl) {
        fetch(`${whatsappUrl}/api/internal/insurance-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env['INTERNAL_API_SECRET'] ?? '' },
          body: JSON.stringify({
            type: 'claim_decision',
            phone: providerTenant.phone,
            lang: 'ar',
            data: {
              claimNumber: existing.claim_number,
              patientNameAr: patient.name_ar ?? 'مريض',
              decision: body.decision,
              totalAmountEgp: Number(existing.total_amount_egp),
              approvedAmountEgp: isApproved ? Number(approvedAmount) : undefined,
              patientCopayEgp: isApproved ? Number(patientCopay) : undefined,
              providerReceivesEgp: isApproved ? providerReceives : undefined,
              rejectionReasonAr: body.rejection_reason_ar,
            },
          }),
        }).catch((err) => {
          console.error('[Claim Decision] WhatsApp notification failed:', err);
        });
      }
    }
  } catch (notifErr) {
    console.error('[Claim Decision] Notification error:', notifErr);
  }

  return NextResponse.json({ claim });
}

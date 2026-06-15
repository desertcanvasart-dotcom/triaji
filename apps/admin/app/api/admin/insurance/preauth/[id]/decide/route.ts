import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireInsuranceAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── PUT /api/admin/insurance/preauth/[id]/decide ───────────────────────────
// Pre-authorization decision by insurer.
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
  const validDecisions = ['approved', 'approved_partial', 'denied'];
  if (!body.decision || !validDecisions.includes(body.decision)) {
    return NextResponse.json(
      { error: "decision is required and must be one of: 'approved', 'approved_partial', 'denied'" },
      { status: 400 }
    );
  }

  // Fetch existing pre-auth
  const { data: existing, error: fetchError } = await supabase
    .from('pre_authorization_requests')
    .select('id, status, patient_id, procedure_description_ar, procedure_description_en')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Pre-authorization request not found' }, { status: 404 });
  }

  if (!['submitted', 'under_review'].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot decide on pre-auth with status '${existing.status}'.` },
      { status: 400 }
    );
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    status: body.decision,
    reviewed_at: new Date().toISOString(),
    reviewed_by: admin.id,
    updated_at: new Date().toISOString(),
  };

  if (body.approved_amount_egp !== undefined) updateData.approved_amount_egp = body.approved_amount_egp;
  if (body.approval_conditions_ar !== undefined) updateData.approval_conditions_ar = body.approval_conditions_ar;
  if (body.denial_reason_ar !== undefined) updateData.denial_reason_ar = body.denial_reason_ar;
  if (body.preauth_reference !== undefined) updateData.preauth_reference = body.preauth_reference;
  if (body.valid_until !== undefined) {
    updateData.valid_until = body.valid_until;
    updateData.valid_from = new Date().toISOString().split('T')[0];
  }

  const { data: preauth, error } = await supabase
    .from('pre_authorization_requests')
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

    if (patient?.phone_number) {
      const patientLang =
        (patient.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
          ?.preferred_language ?? 'ar';
      const whatsappUrl = process.env['WEB_APP_URL'] ?? process.env['NEXT_PUBLIC_WEB_URL'];
      if (whatsappUrl) {
        fetch(`${whatsappUrl}/api/internal/insurance-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env['INTERNAL_API_SECRET'] ?? '' },
          body: JSON.stringify({
            type: 'preauth_decision',
            phone: patient.phone_number,
            lang: patientLang,
            data: {
              procedureDescriptionAr: existing.procedure_description_ar,
              procedureDescriptionEn: existing.procedure_description_en,
              decision: body.decision,
              approvedAmountEgp: body.approved_amount_egp,
              denialReasonAr: body.denial_reason_ar,
              approvalConditionsAr: body.approval_conditions_ar,
              validUntil: body.valid_until,
            },
          }),
        }).catch((err) => {
          console.error('[PreAuth Decision] WhatsApp notification failed:', err);
        });
      }
    }
  } catch (notifErr) {
    console.error('[PreAuth Decision] Notification error:', notifErr);
  }

  return NextResponse.json({ preauth });
}

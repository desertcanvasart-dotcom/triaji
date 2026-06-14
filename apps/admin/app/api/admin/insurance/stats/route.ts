import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireInsuranceAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── GET /api/admin/insurance/stats ─────────────────────────────────────────
// Dashboard stats for insurance admin.
// Auth: insurance_admin or platform_admin.
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  const insuranceCheck = requireInsuranceAccess(admin);
  if (insuranceCheck) return insuranceCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  // 1. Verification requests pending
  let verificationQuery = supabase
    .from('patient_insurance_policies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_verification');
  if (tenant) verificationQuery = verificationQuery.eq('insurer_tenant_id', tenant);
  const { count: verificationRequestsPending } = await verificationQuery;

  // 2. Pre-auth pending (all non-terminal statuses)
  let preauthQuery = supabase
    .from('pre_authorization_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['submitted', 'under_review']);
  if (tenant) preauthQuery = preauthQuery.eq('insurer_tenant_id', tenant);
  const { count: preauthPending } = await preauthQuery;

  // 3. Pre-auth urgent
  let preauthUrgentQuery = supabase
    .from('pre_authorization_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['submitted', 'under_review'])
    .eq('urgency', 'urgent');
  if (tenant) preauthUrgentQuery = preauthUrgentQuery.eq('insurer_tenant_id', tenant);
  const { count: preauthUrgent } = await preauthUrgentQuery;

  // 4. Active claims (submitted, under_review, appealed)
  let activeClaimsQuery = supabase
    .from('insurance_claims')
    .select('id', { count: 'exact', head: true })
    .in('status', ['submitted', 'under_review', 'appealed']);
  if (tenant) activeClaimsQuery = activeClaimsQuery.eq('insurer_tenant_id', tenant);
  const { count: activeClaims } = await activeClaimsQuery;

  // 5. Total payable (approved claims not yet paid)
  let payableQuery = supabase
    .from('insurance_claims')
    .select('provider_receives_egp')
    .in('status', ['approved', 'approved_partial']);
  if (tenant) payableQuery = payableQuery.eq('insurer_tenant_id', tenant);
  const { data: payableClaims } = await payableQuery;

  const totalPayable = payableClaims?.reduce(
    (sum, c) => sum + Number(c.provider_receives_egp ?? 0),
    0
  ) ?? 0;

  return NextResponse.json({
    stats: {
      verification_requests_pending: verificationRequestsPending ?? 0,
      preauth_pending: preauthPending ?? 0,
      preauth_urgent: preauthUrgent ?? 0,
      active_claims: activeClaims ?? 0,
      total_payable_egp: totalPayable,
    },
  });
}

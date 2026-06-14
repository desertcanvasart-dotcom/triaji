import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireInsuranceAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── GET /api/admin/insurance/remittance ────────────────────────────────────
// List remittance records. Auth: insurance_finance or platform_admin.
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  const insuranceCheck = requireInsuranceAccess(admin);
  if (insuranceCheck) return insuranceCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  const url = request.nextUrl;
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status');
  const providerTenantId = url.searchParams.get('provider_tenant_id');

  let query = supabase
    .from('remittance_records')
    .select('*', { count: 'exact' });

  if (tenant) query = query.eq('insurer_tenant_id', tenant);
  if (status) query = query.eq('status', status);
  if (providerTenantId) query = query.eq('provider_tenant_id', providerTenantId);

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: remittances, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    remittances,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
}

// ─── POST /api/admin/insurance/remittance ───────────────────────────────────
// Create batch payment remittance. Auth: insurance_finance or platform_admin.
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  // Require insurance_finance specifically
  if (admin.role !== 'platform_admin' && admin.role !== 'insurance_finance') {
    return NextResponse.json(
      { error: 'Forbidden. Insurance finance access required.' },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const body = await request.json();

  // Validate required fields
  if (!body.provider_tenant_id || !body.period_start || !body.period_end || !Array.isArray(body.claim_ids) || body.claim_ids.length === 0) {
    return NextResponse.json(
      { error: 'provider_tenant_id, period_start, period_end, and claim_ids are required' },
      { status: 400 }
    );
  }

  // Validate period
  if (new Date(body.period_start) >= new Date(body.period_end)) {
    return NextResponse.json(
      { error: 'period_start must be before period_end' },
      { status: 400 }
    );
  }

  // Fetch the claims to verify and compute totals
  const { data: claims, error: claimsError } = await supabase
    .from('insurance_claims')
    .select('id, status, provider_receives_egp, insurer_code, insurer_tenant_id, provider_tenant_id')
    .in('id', body.claim_ids)
    .eq('provider_tenant_id', body.provider_tenant_id)
    .in('status', ['approved', 'approved_partial']);

  if (claimsError) {
    return NextResponse.json({ error: claimsError.message }, { status: 500 });
  }

  if (!claims || claims.length === 0) {
    return NextResponse.json(
      { error: 'No eligible approved claims found for the specified IDs and provider' },
      { status: 400 }
    );
  }

  // All claims must have the same insurer
  const insurerCodes = [...new Set(claims.map((c) => c.insurer_code))];
  if (insurerCodes.length > 1) {
    return NextResponse.json(
      { error: 'All claims in a remittance must belong to the same insurer' },
      { status: 400 }
    );
  }

  const insurerCode = insurerCodes[0] ?? '';
  const firstClaim = claims[0];
  if (!firstClaim) {
    return NextResponse.json({ error: 'No claims found' }, { status: 400 });
  }
  const insurerTenantId = firstClaim.insurer_tenant_id;
  const totalAmount = claims.reduce((sum, c) => sum + Number(c.provider_receives_egp ?? 0), 0);

  // Generate remittance number via RPC
  const { data: remittanceNumber, error: rpcError } = await supabase
    .rpc('next_remittance_number', { p_insurer_code: insurerCode });

  if (rpcError || !remittanceNumber) {
    return NextResponse.json({ error: 'Failed to generate remittance number' }, { status: 500 });
  }

  // Create remittance record
  const { data: remittance, error: insertError } = await supabase
    .from('remittance_records')
    .insert({
      insurer_tenant_id: insurerTenantId,
      provider_tenant_id: body.provider_tenant_id,
      insurer_code: insurerCode,
      remittance_number: remittanceNumber,
      period_start: body.period_start,
      period_end: body.period_end,
      total_claims: claims.length,
      total_amount_egp: totalAmount,
      status: 'issued',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update claims to link remittance and set status to 'paid'
  const claimIds = claims.map((c) => c.id);
  const { error: updateError } = await supabase
    .from('insurance_claims')
    .update({
      remittance_id: remittance.id,
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', claimIds);

  if (updateError) {
    console.error('[Remittance] Failed to update claims:', updateError);
  }

  return NextResponse.json({ remittance }, { status: 201 });
}

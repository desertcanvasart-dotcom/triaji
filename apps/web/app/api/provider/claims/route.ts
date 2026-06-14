import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Auth helpers ───────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  tenant_id: string | null;
  role: string;
  name: string;
  is_active: boolean;
}

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const PROVIDER_ROLES = [
  'platform_admin', 'tenant_admin', 'tenant_manager',
  'clinic_owner', 'clinic_billing', 'clinic_doctor',
  'pharmacy_owner', 'pharmacy_billing', 'pharmacy_staff',
  'lab_owner', 'lab_billing', 'lab_technician',
];

async function authenticateProvider(request: NextRequest): Promise<AdminUser | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (!adminUser || !PROVIDER_ROLES.includes(adminUser.role)) return null;
  return adminUser as AdminUser;
}

function getProviderType(role: string): string {
  if (['pharmacy_owner', 'pharmacy_billing', 'pharmacy_staff'].includes(role)) return 'pharmacy';
  if (['lab_owner', 'lab_billing', 'lab_technician'].includes(role)) return 'lab';
  return 'clinic';
}

// ─── POST /api/provider/claims ──────────────────────────────────────────────
// Create a claim from an invoice. Auth: admin (provider).
export async function POST(request: NextRequest) {
  try {
    const admin = await authenticateProvider(request);
    if (!admin) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const body = await request.json();

    // Validate required fields
    const required = ['patient_id', 'policy_id', 'claim_type', 'total_amount_egp', 'line_items'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
      return NextResponse.json({ error: 'line_items must be a non-empty array' }, { status: 400 });
    }

    // Fetch the policy to get insurer info
    const { data: policy, error: policyError } = await supabase
      .from('patient_insurance_policies')
      .select('id, insurer_code, insurer_tenant_id, copay_pct, status, patient_id')
      .eq('id', body.policy_id)
      .eq('patient_id', body.patient_id)
      .eq('is_active', true)
      .single();

    if (policyError || !policy) {
      return NextResponse.json({ error: 'Policy not found for this patient' }, { status: 404 });
    }

    if (policy.status !== 'active') {
      return NextResponse.json(
        { error: `Policy status is '${policy.status}'. Must be 'active' to submit claims.` },
        { status: 400 }
      );
    }

    // Generate claim number via RPC
    const { data: claimNumber, error: rpcError } = await supabase
      .rpc('next_claim_number', { p_insurer_code: policy.insurer_code });

    if (rpcError || !claimNumber) {
      return NextResponse.json({ error: 'Failed to generate claim number' }, { status: 500 });
    }

    const providerTenantId = admin.role === 'platform_admin' ? (body.provider_tenant_id ?? admin.tenant_id) : admin.tenant_id;
    if (!providerTenantId) {
      return NextResponse.json({ error: 'Provider tenant required' }, { status: 400 });
    }

    const providerType = getProviderType(admin.role);
    const copayPct = Number(policy.copay_pct ?? 20);
    const totalAmount = Number(body.total_amount_egp);
    const claimedAmount = totalAmount * (1 - copayPct / 100);

    const { data: claim, error } = await supabase
      .from('insurance_claims')
      .insert({
        claim_number: claimNumber,
        claim_type: body.claim_type,
        patient_id: body.patient_id,
        policy_id: body.policy_id,
        insurer_code: policy.insurer_code,
        insurer_tenant_id: policy.insurer_tenant_id,
        provider_tenant_id: providerTenantId,
        provider_type: providerType,
        treating_doctor_id: body.treating_doctor_id ?? null,
        clinic_invoice_id: body.clinic_invoice_id ?? null,
        pharmacy_invoice_id: body.pharmacy_invoice_id ?? null,
        booking_id: body.booking_id ?? null,
        health_record_id: body.health_record_id ?? null,
        preauth_id: body.preauth_id ?? null,
        total_amount_egp: totalAmount,
        claimed_amount_egp: claimedAmount,
        line_items: body.line_items,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    console.error('[Claims Create] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

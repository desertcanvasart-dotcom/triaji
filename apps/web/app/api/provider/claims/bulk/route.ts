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

// ─── POST /api/provider/claims/bulk ─────────────────────────────────────────
// Create multiple claims in one request. Auth: admin (provider).
export async function POST(request: NextRequest) {
  try {
    const admin = await authenticateProvider(request);
    if (!admin) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const body = await request.json();

    if (!Array.isArray(body.claims) || body.claims.length === 0) {
      return NextResponse.json({ error: 'claims must be a non-empty array' }, { status: 400 });
    }

    if (body.claims.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 claims per batch' }, { status: 400 });
    }

    const providerTenantId = admin.role === 'platform_admin' ? admin.tenant_id : admin.tenant_id;
    if (!providerTenantId) {
      return NextResponse.json({ error: 'Provider tenant required' }, { status: 400 });
    }

    const providerType = getProviderType(admin.role);
    const results: Array<{ index: number; success: boolean; claim?: unknown; error?: string }> = [];

    for (let i = 0; i < body.claims.length; i++) {
      const claimData = body.claims[i];

      try {
        // Validate required fields
        const required = ['patient_id', 'policy_id', 'claim_type', 'total_amount_egp', 'line_items'];
        const missing = required.find((f) => !claimData[f]);
        if (missing) {
          results.push({ index: i, success: false, error: `${missing} is required` });
          continue;
        }

        // Fetch policy
        const { data: policy, error: policyError } = await supabase
          .from('patient_insurance_policies')
          .select('id, insurer_code, insurer_tenant_id, copay_pct, status')
          .eq('id', claimData.policy_id)
          .eq('patient_id', claimData.patient_id)
          .eq('is_active', true)
          .single();

        if (policyError || !policy) {
          results.push({ index: i, success: false, error: 'Policy not found' });
          continue;
        }

        if (policy.status !== 'active') {
          results.push({ index: i, success: false, error: `Policy status is '${policy.status}'` });
          continue;
        }

        // Generate claim number
        const { data: claimNumber, error: rpcError } = await supabase
          .rpc('next_claim_number', { p_insurer_code: policy.insurer_code });

        if (rpcError || !claimNumber) {
          results.push({ index: i, success: false, error: 'Failed to generate claim number' });
          continue;
        }

        const copayPct = Number(policy.copay_pct ?? 20);
        const totalAmount = Number(claimData.total_amount_egp);
        const claimedAmount = totalAmount * (1 - copayPct / 100);

        const { data: claim, error } = await supabase
          .from('insurance_claims')
          .insert({
            claim_number: claimNumber,
            claim_type: claimData.claim_type,
            patient_id: claimData.patient_id,
            policy_id: claimData.policy_id,
            insurer_code: policy.insurer_code,
            insurer_tenant_id: policy.insurer_tenant_id,
            provider_tenant_id: providerTenantId,
            provider_type: providerType,
            treating_doctor_id: claimData.treating_doctor_id ?? null,
            clinic_invoice_id: claimData.clinic_invoice_id ?? null,
            pharmacy_invoice_id: claimData.pharmacy_invoice_id ?? null,
            booking_id: claimData.booking_id ?? null,
            health_record_id: claimData.health_record_id ?? null,
            preauth_id: claimData.preauth_id ?? null,
            total_amount_egp: totalAmount,
            claimed_amount_egp: claimedAmount,
            line_items: claimData.line_items,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          results.push({ index: i, success: false, error: error.message });
        } else {
          results.push({ index: i, success: true, claim });
        }
      } catch (err) {
        results.push({
          index: i,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: body.claims.length,
      succeeded,
      failed,
      results,
    }, { status: failed === body.claims.length ? 400 : 201 });
  } catch (err) {
    console.error('[Claims Bulk] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

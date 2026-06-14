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

// ─── PUT /api/provider/claims/[id]/appeal ───────────────────────────────────
// Appeal a rejected claim. Auth: admin (provider).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await authenticateProvider(request);
    if (!admin) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceClient();

    const body = await request.json();

    if (!body.appeal_reason_ar) {
      return NextResponse.json({ error: 'appeal_reason_ar is required' }, { status: 400 });
    }

    // Verify the claim belongs to this provider
    let query = supabase
      .from('insurance_claims')
      .select('id, status, claim_number')
      .eq('id', id);
    if (admin.role !== 'platform_admin' && admin.tenant_id) {
      query = query.eq('provider_tenant_id', admin.tenant_id);
    }

    const { data: existing, error: verifyError } = await query.single();

    if (verifyError || !existing) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Only rejected claims can be appealed
    if (existing.status !== 'rejected') {
      return NextResponse.json(
        { error: `Cannot appeal claim with status '${existing.status}'. Must be 'rejected'.` },
        { status: 400 }
      );
    }

    const { data: claim, error } = await supabase
      .from('insurance_claims')
      .update({
        status: 'appealed',
        appeal_submitted_at: new Date().toISOString(),
        appeal_reason_ar: body.appeal_reason_ar,
        appeal_outcome: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ claim });
  } catch (err) {
    console.error('[Claims Appeal] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import type { AdminRole } from '@/lib/auth/types';
import { getPublicOrigin } from '@/lib/public-origin';

export const dynamic = 'force-dynamic';

const ALL_ROLES: AdminRole[] = [
  'platform_admin',
  'tenant_admin', 'tenant_manager',
  'clinic_owner', 'clinic_receptionist', 'clinic_billing', 'clinic_doctor',
  'lab_owner', 'lab_receptionist', 'lab_technician', 'lab_billing',
  'pharmacy_owner', 'pharmacy_staff', 'pharmacy_billing',
  'insurance_admin', 'insurance_reviewer', 'insurance_finance',
  'icu_coordinator',
  'chain_owner',
  'branch_manager',
];

const CHAIN_ROLES: AdminRole[] = ['chain_owner', 'branch_manager'];

/** `phone` is optional here so the pre-migration-067 fallback select still fits. */
interface AdminUserListRow {
  id: string;
  tenant_id: string | null;
  chain_id: string | null;
  branch_tenant_id: string | null;
  role: AdminRole;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
}

interface InviteBody {
  email?: string;
  name?: string;
  phone?: string | null;
  role?: AdminRole;
  tenant_id?: string | null;
  chain_id?: string | null;
  branch_tenant_id?: string | null;
}

function validateInvite(body: InviteBody): string | null {
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return 'A valid email is required.';
  }
  if (!body.name || body.name.trim().length === 0) {
    return 'Name is required.';
  }
  if (!body.role || !ALL_ROLES.includes(body.role)) {
    return 'Invalid role.';
  }
  // Optional, but when given it has to be a real Egyptian mobile — it's the
  // number password-reset codes get sent to.
  if (body.phone && !/^01[0125]\d{8}$/.test(body.phone.trim())) {
    return 'Mobile must be an Egyptian number starting 010, 011, 012 or 015.';
  }
  if (body.role === 'chain_owner' && !body.chain_id) {
    return 'chain_id is required for chain_owner.';
  }
  if (body.role === 'branch_manager' && !body.branch_tenant_id) {
    return 'branch_tenant_id is required for branch_manager.';
  }
  if (
    body.role !== 'platform_admin' &&
    !CHAIN_ROLES.includes(body.role) &&
    !body.tenant_id
  ) {
    return 'tenant_id is required for tenant-scoped roles.';
  }
  return null;
}

/** GET /api/admin/users — list admin users (platform admin only) */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  const BASE_COLUMNS = 'id, tenant_id, chain_id, branch_tenant_id, role, name, email, is_active, created_at';

  const withPhone = await supabase
    .from('admin_users')
    .select(`${BASE_COLUMNS}, phone`)
    .order('created_at', { ascending: false });

  let users = withPhone.data as AdminUserListRow[] | null;
  let error = withPhone.error;

  // Graceful degradation until migration 067 is applied live: list users
  // without the mobile column rather than failing the whole page.
  if (error && /phone/.test(error.message)) {
    console.warn('[admin/users] admin_users.phone missing (apply migration 067):', error.message);
    const fallback = await supabase
      .from('admin_users')
      .select(BASE_COLUMNS)
      .order('created_at', { ascending: false });
    users = fallback.data as AdminUserListRow[] | null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve tenant / chain names in one query each (admin_users has two FKs
  // to tenants, so an embedded select would be ambiguous).
  const tenantIds = [
    ...new Set(
      (users ?? []).flatMap((u) => [u.tenant_id, u.branch_tenant_id]).filter(Boolean)
    ),
  ] as string[];
  const chainIds = [...new Set((users ?? []).map((u) => u.chain_id).filter(Boolean))] as string[];

  const tenantNames = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name_en')
      .in('id', tenantIds);
    for (const t of tenants ?? []) tenantNames.set(t.id, t.name_en);
  }

  const chainNames = new Map<string, string>();
  if (chainIds.length > 0) {
    const { data: chains } = await supabase
      .from('chains')
      .select('id, name_en')
      .in('id', chainIds);
    for (const c of chains ?? []) chainNames.set(c.id, c.name_en);
  }

  const enriched = (users ?? []).map((u) => ({
    ...u,
    phone: u.phone ?? null,
    tenant_name: u.tenant_id ? (tenantNames.get(u.tenant_id) ?? null) : null,
    branch_tenant_name: u.branch_tenant_id ? (tenantNames.get(u.branch_tenant_id) ?? null) : null,
    chain_name: u.chain_id ? (chainNames.get(u.chain_id) ?? null) : null,
  }));

  return NextResponse.json({ users: enriched });
}

/**
 * POST /api/admin/users — invite a new admin user (platform admin only).
 *
 * Creates the Supabase Auth user via an invite link (no password yet) and the
 * matching admin_users row, then returns the one-time set-password link for
 * the platform admin to send to the invitee. Re-posting for an existing auth
 * user issues a fresh recovery link (used for "resend link").
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validationError = validateInvite(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const email = body.email!.trim().toLowerCase();
  const supabase = createAdminClient();
  const redirectTo = `${getPublicOrigin(request)}/set-password`;

  // Try a fresh invite first; fall back to a recovery link when the auth user
  // already exists (re-invite / resend).
  let userId: string | null = null;
  let actionLink: string | null = null;
  let isNewAuthUser = false;

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (!inviteError && inviteData?.user) {
    userId = inviteData.user.id;
    actionLink = inviteData.properties?.action_link ?? null;
    isNewAuthUser = true;
  } else {
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (recoveryError || !recoveryData?.user) {
      return NextResponse.json(
        { error: `Could not create invite: ${inviteError?.message ?? recoveryError?.message}` },
        { status: 500 }
      );
    }
    userId = recoveryData.user.id;
    actionLink = recoveryData.properties?.action_link ?? null;
  }

  const baseRow = {
    id: userId,
    tenant_id: body.tenant_id ?? null,
    chain_id: body.chain_id ?? null,
    branch_tenant_id: body.branch_tenant_id ?? null,
    role: body.role,
    name: body.name!.trim(),
    email,
    is_active: true,
  };

  let { data: adminUser, error: upsertError } = await supabase
    .from('admin_users')
    .upsert({ ...baseRow, phone: body.phone?.trim() || null }, { onConflict: 'id' })
    .select()
    .single();

  // Graceful degradation until migration 067 is applied live: create the user
  // without the mobile rather than failing the invite outright.
  if (upsertError && /phone/.test(upsertError.message)) {
    console.warn('[admin/users] admin_users.phone missing (apply migration 067):', upsertError.message);
    ({ data: adminUser, error: upsertError } = await supabase
      .from('admin_users')
      .upsert(baseRow, { onConflict: 'id' })
      .select()
      .single());
  }

  if (upsertError) {
    // Don't leave an orphaned auth user behind on a failed first-time invite.
    if (isNewAuthUser && userId) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    user: adminUser,
    invite_link: actionLink,
    resent: !isNewAuthUser,
  });
}

/**
 * PATCH /api/admin/users — activate/deactivate an admin user, or set the mobile
 * their password-reset codes go to (platform admin only).
 */
export async function PATCH(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  let body: { id?: string; is_active?: boolean; phone?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hasActive = typeof body.is_active === 'boolean';
  const hasPhone = body.phone !== undefined;

  if (!body.id || (!hasActive && !hasPhone)) {
    return NextResponse.json(
      { error: 'id and one of is_active or phone are required.' },
      { status: 400 }
    );
  }

  const phone = body.phone?.trim() || null;
  if (hasPhone && phone && !/^01[0125]\d{8}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Mobile must be an Egyptian number starting 010, 011, 012 or 015.' },
      { status: 400 }
    );
  }

  if (body.id === authResult.admin.id && hasActive && !body.is_active) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from('admin_users')
    .update({
      ...(hasActive ? { is_active: body.is_active } : {}),
      ...(hasPhone ? { phone } : {}),
    })
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    if (hasPhone && /phone/.test(error.message)) {
      return NextResponse.json(
        { error: 'Mobile numbers need migration 067 applied to the database first.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: updated });
}

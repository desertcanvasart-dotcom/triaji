import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@triaji/shared/lib/email/client';

export const dynamic = 'force-dynamic';

function liveEmailHtml(name: string, facility: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A2F4A;line-height:1.7">
  <h2 style="color:#0d9488;margin:0 0 16px">DoctorTrio</h2>
  <p>Hi ${name},</p>
  <p><strong>${facility}</strong> is now approved and live on DoctorTrio. You can sign in to your dashboard with the email and password you registered.</p>
  <p style="margin:20px 0"><a href="https://admin.doctortrio.online" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px">Go to your dashboard</a></p>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8">This is an automated message from the DoctorTrio platform.</p>
</div>`;
}

/** POST /api/admin/provider-approvals/[tenantId] — approve: activate tenant + its admin user(s) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { tenantId } = await params;
  const supabase = createAdminClient();

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .update({ is_active: true })
    .eq('id', tenantId)
    .select('name_en')
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: tenantError?.message ?? 'Facility not found.' }, { status: 404 });
  }

  const { data: users, error: usersError } = await supabase
    .from('admin_users')
    .update({ is_active: true })
    .eq('tenant_id', tenantId)
    .select('name, email');

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  // Tell the facility it's live (best-effort).
  for (const u of users ?? []) {
    await sendEmail({
      to: u.email as string,
      subject: `${tenant.name_en} is now live on DoctorTrio`,
      html: liveEmailHtml((u.name as string) ?? 'there', tenant.name_en as string),
    }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, activated_users: users?.length ?? 0 });
}

/** DELETE /api/admin/provider-approvals/[tenantId] — reject: remove the pending facility + its users */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { tenantId } = await params;
  const supabase = createAdminClient();

  // Guard: only reject a still-pending (inactive) facility.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, is_active')
    .eq('id', tenantId)
    .single();
  if (!tenant) {
    return NextResponse.json({ error: 'Facility not found.' }, { status: 404 });
  }
  if (tenant.is_active) {
    return NextResponse.json({ error: 'Facility is already active; deactivate it first.' }, { status: 409 });
  }

  // Remove the auth users, then the rows.
  const { data: users } = await supabase.from('admin_users').select('id').eq('tenant_id', tenantId);
  for (const u of users ?? []) {
    await supabase.auth.admin.deleteUser(u.id as string).catch(() => undefined);
  }
  await supabase.from('admin_users').delete().eq('tenant_id', tenantId);
  await supabase.from('tenant_config').delete().eq('tenant_id', tenantId);

  const { error: delError } = await supabase.from('tenants').delete().eq('id', tenantId);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

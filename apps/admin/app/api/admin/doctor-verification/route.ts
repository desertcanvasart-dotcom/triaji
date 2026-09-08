import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { specsForClinicMode } from '@triaji/shared/constants/doctor-documents';

export const dynamic = 'force-dynamic';

/** GET /api/admin/doctor-verification — list doctor registrations */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;

  // Only platform admins can access verification
  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required.' },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') ?? 'pending';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '25', 10);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('doctor_accounts')
    .select('*, governorates(name_ar, name_en)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    query = query.eq('verification_status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve requested-facility names for existing_clinic requests (the column
  // exists once migration 064 is applied; absent before that).
  const registrations = (data ?? []) as Array<Record<string, unknown>>;
  const requestedIds = [
    ...new Set(registrations.map((r) => r['requested_tenant_id']).filter(Boolean)),
  ] as string[];
  if (requestedIds.length > 0) {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name_en')
      .in('id', requestedIds);
    const names = new Map((tenants ?? []).map((t) => [t.id, t.name_en]));
    for (const r of registrations) {
      const tid = r['requested_tenant_id'] as string | null;
      if (tid && names.has(tid)) r['tenants'] = { name_en: names.get(tid) };
    }
  }

  // Attach document readiness so the queue can show progress and disable
  // Approve, rather than only failing once the reviewer clicks it.
  const pendingIds = registrations
    .filter((r) => r['verification_status'] === 'pending')
    .map((r) => r['id'] as string);

  if (pendingIds.length > 0) {
    const { data: docs, error: docsError } = await supabase
      .from('doctor_documents')
      .select('doctor_account_id, doc_type, status')
      .in('doctor_account_id', pendingIds);

    if (docsError) {
      console.warn('[doctor-verification] could not load document readiness:', docsError.message);
    } else {
      const byAccount = new Map<string, Map<string, string>>();
      for (const d of docs ?? []) {
        const accountId = d.doctor_account_id as string;
        if (!byAccount.has(accountId)) byAccount.set(accountId, new Map());
        byAccount.get(accountId)!.set(d.doc_type as string, d.status as string);
      }

      for (const r of registrations) {
        if (r['verification_status'] !== 'pending') continue;
        const specs = specsForClinicMode(
          r['clinic_mode'] as string | null,
          Boolean(r['foreign_degree']),
        ).filter((s) => s.required);
        const statuses = byAccount.get(r['id'] as string) ?? new Map<string, string>();
        const approved = specs.filter((s) => statuses.get(s.type) === 'approved').length;
        r['document_readiness'] = {
          required: specs.length,
          approved,
          ready: approved === specs.length,
        };
      }
    }
  }

  return NextResponse.json({
    registrations,
    total: count ?? 0,
    page,
    limit,
  });
}

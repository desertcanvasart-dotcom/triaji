import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_IDS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BulkDeleteBody {
  ids?: unknown;
}

/**
 * POST /api/admin/doctors/bulk-delete — permanently delete several doctors.
 *
 * Tenant admins can only delete their own doctors; platform admins can delete
 * any. Doctors are referenced (without ON DELETE CASCADE) by bookings, patient
 * history, prescriptions, referrals, lab orders and more, so a delete fails for
 * any doctor that still has related records. We try the whole set in one
 * statement (the common case for unused/seed doctors) and, if that trips a
 * foreign-key violation, fall back to per-row deletes so we can remove what we
 * can and report exactly which doctors were blocked.
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  let body: BulkDeleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = Array.from(
    new Set(rawIds.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v)))
  );

  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'Provide at least one valid doctor id.' },
      { status: 400 }
    );
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Cannot delete more than ${MAX_IDS} doctors at once.` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  // Narrow to the doctors this admin is actually allowed to delete.
  let ownedQuery = supabase.from('doctors').select('id').in('id', ids);
  if (tenant) ownedQuery = ownedQuery.eq('tenant_id', tenant);
  const { data: owned, error: ownedError } = await ownedQuery;

  if (ownedError) {
    return NextResponse.json({ error: ownedError.message }, { status: 500 });
  }

  const deletableIds = (owned ?? []).map((r) => r.id as string);
  const notFound = ids.filter((id) => !deletableIds.includes(id));

  if (deletableIds.length === 0) {
    return NextResponse.json(
      { error: 'None of the selected doctors were found in your scope.' },
      { status: 404 }
    );
  }

  const deleted: string[] = [];
  const blocked: { id: string; reason: string }[] = [];

  // Fast path: delete the whole set at once.
  let bulkQuery = supabase.from('doctors').delete().in('id', deletableIds);
  if (tenant) bulkQuery = bulkQuery.eq('tenant_id', tenant);
  const { error: bulkError } = await bulkQuery;

  if (!bulkError) {
    deleted.push(...deletableIds);
  } else {
    // One FK violation rolls back the whole statement, so retry row by row to
    // delete the removable ones and collect a reason for each blocked doctor.
    for (const id of deletableIds) {
      let rowQuery = supabase.from('doctors').delete().eq('id', id);
      if (tenant) rowQuery = rowQuery.eq('tenant_id', tenant);
      const { error } = await rowQuery;
      if (!error) {
        deleted.push(id);
      } else {
        blocked.push({
          id,
          reason:
            error.code === '23503'
              ? 'Has related records (bookings, history, etc.) and cannot be permanently deleted. Deactivate instead.'
              : error.message,
        });
      }
    }
  }

  return NextResponse.json({
    deleted_count: deleted.length,
    deleted,
    blocked,
    not_found: notFound,
  });
}

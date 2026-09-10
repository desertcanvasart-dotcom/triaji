import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    /relation .*doctor_visit_types.* does not exist/i.test(error?.message ?? '')
  );
}

/** GET /api/admin/doctors/[id]/visit-types */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('doctor_visit_types')
    .select('*')
    .eq('doctor_id', id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ visit_types: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ visit_types: data ?? [] });
}

/** POST /api/admin/doctors/[id]/visit-types — add a visit type */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const name = (body['name'] ?? '').toString().trim();
  const duration = Number(body['duration_minutes']);
  const isDefault = body['is_default'] === true;

  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Duration must be a positive number of minutes.' }, { status: 400 });
  }

  // Only one default per doctor.
  if (isDefault) {
    const { error: clearError } = await supabase
      .from('doctor_visit_types')
      .update({ is_default: false })
      .eq('doctor_id', id)
      .eq('is_default', true);
    if (clearError && !isMissingTable(clearError)) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('doctor_visit_types')
    .insert({
      doctor_id: id,
      tenant_id: admin.tenant_id,
      name,
      duration_minutes: Math.round(duration),
      is_default: isDefault,
    })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Visit types are not available yet — apply migration 075.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ visit_type: data }, { status: 201 });
}

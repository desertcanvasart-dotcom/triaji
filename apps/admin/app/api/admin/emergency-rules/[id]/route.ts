import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/emergency-rules/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('emergency_triggers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
  }

  return NextResponse.json({ rule: data });
}

/** PUT /api/admin/emergency-rules/[id] */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  const directFields = ['rule_name', 'description_ar', 'response_ar', 'escalation_type', 'priority', 'is_active'];
  for (const f of directFields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }

  if (body['symptom_conditions'] !== undefined) {
    try {
      updateData['symptom_conditions'] = typeof body['symptom_conditions'] === 'string'
        ? JSON.parse(body['symptom_conditions'])
        : body['symptom_conditions'];
    } catch {
      return NextResponse.json({ error: 'Invalid symptom_conditions JSON.' }, { status: 400 });
    }
  }

  if (body['profile_conditions'] !== undefined) {
    try {
      updateData['profile_conditions'] = typeof body['profile_conditions'] === 'string'
        ? JSON.parse(body['profile_conditions'])
        : body['profile_conditions'];
    } catch {
      return NextResponse.json({ error: 'Invalid profile_conditions JSON.' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('emergency_triggers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule: data });
}

/** DELETE /api/admin/emergency-rules/[id] — soft delete */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('emergency_triggers')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

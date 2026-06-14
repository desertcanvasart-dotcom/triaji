import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/emergency-rules — list all rules ordered by priority */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('emergency_triggers')
    .select('*')
    .order('priority', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

/** POST /api/admin/emergency-rules — create rule */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  if (!body['rule_name'] || !body['escalation_type']) {
    return NextResponse.json(
      { error: 'rule_name and escalation_type are required.' },
      { status: 400 }
    );
  }

  // Parse conditions
  let symptomConditions = {};
  let profileConditions = {};
  try {
    symptomConditions = typeof body['symptom_conditions'] === 'string'
      ? JSON.parse(body['symptom_conditions'])
      : (body['symptom_conditions'] ?? {});
    profileConditions = typeof body['profile_conditions'] === 'string'
      ? JSON.parse(body['profile_conditions'])
      : (body['profile_conditions'] ?? {});
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in conditions.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('emergency_triggers')
    .insert({
      rule_name: body['rule_name'],
      description_ar: body['description_ar'] ?? '',
      symptom_conditions: symptomConditions,
      profile_conditions: profileConditions,
      response_ar: body['response_ar'] ?? '',
      escalation_type: body['escalation_type'],
      priority: body['priority'] ?? 100,
      is_active: body['is_active'] ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule: data }, { status: 201 });
}

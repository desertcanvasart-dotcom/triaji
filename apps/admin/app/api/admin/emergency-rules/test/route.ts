import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TriggerRule {
  id: string;
  rule_name: string;
  description_ar: string;
  symptom_conditions: {
    any_of?: string[];
    all_of?: string[];
    none_of?: string[];
  };
  profile_conditions: Record<string, unknown>;
  response_ar: string;
  escalation_type: string;
  priority: number;
  is_active: boolean;
}

/** POST /api/admin/emergency-rules/test — test rule evaluation */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const body = await request.json();
  const symptoms: string[] = body['symptoms'] ?? [];

  if (symptoms.length === 0) {
    return NextResponse.json({ error: 'symptoms array is required.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: rules, error } = await supabase
    .from('emergency_triggers')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const triggered: Array<{
    rule_name: string;
    escalation_type: string;
    response_ar: string;
    priority: number;
  }> = [];

  for (const rule of (rules ?? []) as TriggerRule[]) {
    const conditions = rule.symptom_conditions;
    let matches = true;

    // Check any_of
    if (conditions.any_of && conditions.any_of.length > 0) {
      const hasAny = conditions.any_of.some((s) => symptoms.includes(s));
      if (!hasAny) matches = false;
    }

    // Check all_of
    if (matches && conditions.all_of && conditions.all_of.length > 0) {
      const hasAll = conditions.all_of.every((s) => symptoms.includes(s));
      if (!hasAll) matches = false;
    }

    // Check none_of
    if (matches && conditions.none_of && conditions.none_of.length > 0) {
      const hasNone = conditions.none_of.some((s) => symptoms.includes(s));
      if (hasNone) matches = false;
    }

    if (matches) {
      triggered.push({
        rule_name: rule.rule_name,
        escalation_type: rule.escalation_type,
        response_ar: rule.response_ar,
        priority: rule.priority,
      });
    }
  }

  return NextResponse.json({ triggered });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_SLOT_DURATION_MIN } from '@/lib/slots';

export const dynamic = 'force-dynamic';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    /relation .*doctor_schedule_templates.* does not exist/i.test(error?.message ?? '')
  );
}

/** GET /api/admin/doctors/[id]/schedule-templates */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('doctor_schedule_templates')
    .select('*')
    .eq('doctor_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ templates: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

/** POST /api/admin/doctors/[id]/schedule-templates — save a weekly pattern */
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
  const daysOfWeek: unknown = body['days_of_week'];
  const times: unknown = body['times'];
  const duration = Number(body['duration_minutes'] ?? DEFAULT_SLOT_DURATION_MIN);

  const days = Array.isArray(daysOfWeek)
    ? daysOfWeek.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];
  const cleanTimes = Array.isArray(times)
    ? times.filter((t): t is string => typeof t === 'string' && TIME_RE.test(t))
    : [];

  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (days.length === 0 || cleanTimes.length === 0) {
    return NextResponse.json({ error: 'Pick at least one day and one time.' }, { status: 400 });
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Duration must be a positive number.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('doctor_schedule_templates')
    .insert({
      doctor_id: id,
      tenant_id: admin.tenant_id,
      name,
      days_of_week: days,
      times: cleanTimes,
      duration_minutes: Math.round(duration),
    })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Templates are not available yet — apply migration 075.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data }, { status: 201 });
}

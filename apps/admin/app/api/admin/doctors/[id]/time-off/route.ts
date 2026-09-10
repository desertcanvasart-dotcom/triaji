import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { intervalsOverlap, DEFAULT_SLOT_DURATION_MIN } from '@/lib/slots';

export const dynamic = 'force-dynamic';

/** doctor_time_off may not exist yet on a DB missing migration 074. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    /relation .*doctor_time_off.* does not exist/i.test(error?.message ?? '')
  );
}

/** GET /api/admin/doctors/[id]/time-off — current + upcoming blocks */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('doctor_time_off')
    .select('*')
    .eq('doctor_id', id)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  if (error) {
    // Degrade gracefully until the migration is applied live.
    if (isMissingTable(error)) return NextResponse.json({ time_off: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ time_off: data ?? [] });
}

/** POST /api/admin/doctors/[id]/time-off — block an interval */
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

  const startsAt = body['starts_at'];
  const endsAt = body['ends_at'];
  const reason: string | null = (body['reason'] ?? '').toString().trim() || null;

  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();

  if (!startsAt || !endsAt || Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return NextResponse.json({ error: 'starts_at and ends_at are required.' }, { status: 400 });
  }
  if (endMs <= startMs) {
    return NextResponse.json({ error: 'End must be after start.' }, { status: 400 });
  }

  // Surface (but don't block on) booked slots that fall inside the new window.
  let bookedConflictCount = 0;
  const { data: booked } = await supabase
    .from('doctor_availability')
    .select('slot_datetime, duration_minutes')
    .eq('doctor_id', id)
    .eq('is_booked', true)
    .gte('slot_datetime', new Date(startMs - 24 * 60 * 60_000).toISOString())
    .lte('slot_datetime', new Date(endMs).toISOString());

  bookedConflictCount = (booked ?? []).filter((s) => {
    const sStart = new Date(s.slot_datetime as string).getTime();
    const sEnd = sStart + ((s.duration_minutes as number) ?? DEFAULT_SLOT_DURATION_MIN) * 60_000;
    return intervalsOverlap(sStart, sEnd, startMs, endMs);
  }).length;

  const { data, error } = await supabase
    .from('doctor_time_off')
    .insert({
      doctor_id: id,
      tenant_id: admin.tenant_id,
      starts_at: startsAt,
      ends_at: endsAt,
      reason,
    })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Time-off is not available yet — apply migration 074 to the database.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { time_off: data, booked_conflict_count: bookedConflictCount },
    { status: 201 }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import {
  buildSlotDatetime,
  slotsConflict,
  intervalsOverlap,
  DEFAULT_SLOT_DURATION_MIN,
  CONFLICT_WINDOW_MS,
} from '@/lib/slots';
import { loadBookingPolicy, resolveDuration } from '@/lib/booking-policy';

export const dynamic = 'force-dynamic';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** POST /api/admin/doctors/[id]/slots/bulk — add weekly schedule */
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

  const daysOfWeek: number[] = body['days_of_week'] ?? [];
  const times: string[] = body['times'] ?? [];
  const weeks: number = body['weeks'] ?? 4;
  const visitTypeId: string | null = body['visit_type_id'] ?? null;

  if (daysOfWeek.length === 0 || times.length === 0) {
    return NextResponse.json(
      { error: 'days_of_week and times are required.' },
      { status: 400 }
    );
  }

  if (weeks < 1 || weeks > 12) {
    return NextResponse.json(
      { error: 'weeks must be between 1 and 12.' },
      { status: 400 }
    );
  }

  // Booking policy governs lead time, horizon, buffer and default duration.
  const policy = await loadBookingPolicy(supabase, id);
  const durationMinutes: number = body['duration_minutes']
    ? Number(body['duration_minutes'])
    : await resolveDuration(supabase, id, visitTypeId, policy.default_duration_min);

  // Generate candidate slots as floating clinic-local wall-clock times (naive
  // `Z`), using pure UTC calendar math so the result never depends on the
  // server's timezone and matches the single-add convention exactly.
  const now = new Date();
  const earliest = now.getTime() + policy.min_notice_minutes * 60_000; // lead time
  const horizon = now.getTime() + policy.max_advance_days * 86_400_000; // booking window
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const candidates = new Map<string, number>(); // slot_datetime -> duration
  const totalDays = weeks * 7;

  for (let i = 0; i < totalDays; i++) {
    const day = new Date(todayUtc + i * 86_400_000);
    if (!daysOfWeek.includes(day.getUTCDay())) continue;

    const dateStr = `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;
    for (const time of times) {
      if (!TIME_RE.test(time)) continue;
      const iso = buildSlotDatetime(dateStr, time);
      if (!iso) continue;
      const startMs = new Date(iso).getTime();
      if (startMs <= earliest || startMs > horizon) continue; // lead time / horizon
      candidates.set(iso, durationMinutes); // Map de-dups exact repeats
    }
  }

  if (candidates.size === 0) {
    return NextResponse.json(
      { error: 'No valid future slots could be generated.' },
      { status: 400 }
    );
  }

  // Skip candidates that overlap slots the doctor already has. Fetch existing
  // slots across the whole generated span (widened for duration) in one query.
  const candidateStarts = Array.from(candidates.keys()).map((iso) => new Date(iso).getTime());
  const minStart = Math.min(...candidateStarts);
  const maxStart = Math.max(...candidateStarts);

  const { data: existing, error: existingError } = await supabase
    .from('doctor_availability')
    .select('slot_datetime, duration_minutes')
    .eq('doctor_id', id)
    .gte('slot_datetime', new Date(minStart - CONFLICT_WINDOW_MS).toISOString())
    .lte('slot_datetime', new Date(maxStart + CONFLICT_WINDOW_MS).toISOString());

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingIntervals = (existing ?? []).map((s) => ({
    start: new Date(s.slot_datetime as string).getTime(),
    dur: (s.duration_minutes as number) ?? DEFAULT_SLOT_DURATION_MIN,
  }));

  // Time-off blocks over the same span — candidates inside a block are skipped.
  // Degrade quietly if doctor_time_off isn't present yet (migration 074).
  const { data: timeOff, error: timeOffError } = await supabase
    .from('doctor_time_off')
    .select('starts_at, ends_at')
    .eq('doctor_id', id)
    .lt('starts_at', new Date(maxStart + CONFLICT_WINDOW_MS).toISOString())
    .gt('ends_at', new Date(minStart - CONFLICT_WINDOW_MS).toISOString());

  if (timeOffError && timeOffError.code !== '42P01' && !/does not exist/i.test(timeOffError.message)) {
    return NextResponse.json({ error: timeOffError.message }, { status: 500 });
  }

  const offIntervals = (timeOff ?? []).map((o) => ({
    start: new Date(o.starts_at as string).getTime(),
    end: new Date(o.ends_at as string).getTime(),
  }));

  const accepted: Array<{
    doctor_id: string;
    slot_datetime: string;
    duration_minutes: number;
    is_booked: boolean;
    source: string;
    tenant_id: string | null;
    visit_type_id?: string;
  }> = [];

  for (const [iso, dur] of candidates) {
    const start = new Date(iso).getTime();
    const end = start + dur * 60_000;
    const clashesExisting = existingIntervals.some((e) =>
      slotsConflict(start, dur, e.start, e.dur, policy.buffer_minutes)
    );
    const clashesAccepted = accepted.some((a) =>
      slotsConflict(start, dur, new Date(a.slot_datetime).getTime(), a.duration_minutes, policy.buffer_minutes)
    );
    const blockedByTimeOff = offIntervals.some((o) => intervalsOverlap(start, end, o.start, o.end));
    if (clashesExisting || clashesAccepted || blockedByTimeOff) continue;

    accepted.push({
      doctor_id: id,
      slot_datetime: iso,
      duration_minutes: dur,
      is_booked: false,
      source: 'native',
      tenant_id: admin.tenant_id,
      ...(visitTypeId ? { visit_type_id: visitTypeId } : {}),
    });
  }

  const skipped = candidates.size - accepted.length;

  if (accepted.length === 0) {
    return NextResponse.json(
      {
        created: 0,
        skipped,
        message: `No slots created — all ${skipped} already exist or overlap.`,
      },
      { status: 200 }
    );
  }

  const { data, error } = await supabase
    .from('doctor_availability')
    .insert(accepted)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const created = data?.length ?? 0;
  return NextResponse.json(
    {
      created,
      skipped,
      message:
        skipped > 0
          ? `${created} slot(s) created, ${skipped} skipped (already exist or overlap).`
          : `${created} slot(s) created successfully.`,
    },
    { status: 201 }
  );
}

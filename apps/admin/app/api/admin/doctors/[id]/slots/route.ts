import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import {
  slotsConflict,
  DEFAULT_SLOT_DURATION_MIN,
  CONFLICT_WINDOW_MS,
} from '@/lib/slots';
import { loadBookingPolicy, resolveDuration } from '@/lib/booking-policy';

export const dynamic = 'force-dynamic';

/** GET /api/admin/doctors/[id]/slots — list all slots (including booked) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', id)
    .order('slot_datetime', { ascending: true });

  if (from) {
    query = query.gte('slot_datetime', from);
  }
  if (to) {
    query = query.lte('slot_datetime', to);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data ?? [] });
}

/** POST /api/admin/doctors/[id]/slots — add single slot */
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

  if (!body['slot_datetime']) {
    return NextResponse.json(
      { error: 'slot_datetime is required.' },
      { status: 400 }
    );
  }

  const slotDate = new Date(body['slot_datetime']);
  if (Number.isNaN(slotDate.getTime())) {
    return NextResponse.json({ error: 'Invalid slot_datetime.' }, { status: 400 });
  }

  const now = Date.now();
  const newStart = slotDate.getTime();
  const visitTypeId: string | null = body['visit_type_id'] ?? null;

  // Booking policy: lead time, horizon, default duration and inter-slot buffer.
  const policy = await loadBookingPolicy(supabase, id);
  const durationMinutes: number = body['duration_minutes']
    ? Number(body['duration_minutes'])
    : await resolveDuration(supabase, id, visitTypeId, policy.default_duration_min);

  if (newStart <= now + policy.min_notice_minutes * 60_000) {
    return NextResponse.json(
      {
        error:
          policy.min_notice_minutes > 0
            ? `Slot must be at least ${policy.min_notice_minutes} minutes from now.`
            : 'Slot must be in the future.',
      },
      { status: 400 }
    );
  }
  if (newStart > now + policy.max_advance_days * 86_400_000) {
    return NextResponse.json(
      { error: `Slot is beyond the ${policy.max_advance_days}-day booking horizon.` },
      { status: 400 }
    );
  }

  // Reject a slot that overlaps (or sits within the buffer of) an existing one.
  // Fetch a bounded window around the new slot and check each neighbour.
  const { data: nearby, error: nearbyError } = await supabase
    .from('doctor_availability')
    .select('slot_datetime, duration_minutes')
    .eq('doctor_id', id)
    .gte('slot_datetime', new Date(newStart - CONFLICT_WINDOW_MS).toISOString())
    .lte('slot_datetime', new Date(newStart + CONFLICT_WINDOW_MS).toISOString());

  if (nearbyError) {
    return NextResponse.json({ error: nearbyError.message }, { status: 500 });
  }

  const conflict = (nearby ?? []).some((s) =>
    slotsConflict(
      newStart,
      durationMinutes,
      new Date(s.slot_datetime as string).getTime(),
      (s.duration_minutes as number) ?? DEFAULT_SLOT_DURATION_MIN,
      policy.buffer_minutes
    )
  );

  if (conflict) {
    return NextResponse.json(
      {
        error:
          policy.buffer_minutes > 0
            ? `This time overlaps or is within the ${policy.buffer_minutes}-minute buffer of an existing slot.`
            : 'This time overlaps an existing slot for this doctor.',
      },
      { status: 409 }
    );
  }

  // Refuse a slot that lands inside a time-off block. Degrade quietly if the
  // doctor_time_off table isn't present yet (migration 074 not applied).
  const newEnd = newStart + durationMinutes * 60_000;
  const { data: offRows, error: offError } = await supabase
    .from('doctor_time_off')
    .select('id')
    .eq('doctor_id', id)
    .lt('starts_at', new Date(newEnd).toISOString())
    .gt('ends_at', new Date(newStart).toISOString());

  if (offError && offError.code !== '42P01' && !/does not exist/i.test(offError.message)) {
    return NextResponse.json({ error: offError.message }, { status: 500 });
  }
  if ((offRows ?? []).length > 0) {
    return NextResponse.json(
      { error: 'This time is blocked by a day off / time off.' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('doctor_availability')
    .insert({
      doctor_id: id,
      slot_datetime: body['slot_datetime'],
      duration_minutes: durationMinutes,
      is_booked: false,
      source: 'native',
      tenant_id: admin.tenant_id,
      ...(visitTypeId ? { visit_type_id: visitTypeId } : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slot: data }, { status: 201 });
}

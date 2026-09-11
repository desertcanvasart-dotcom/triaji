import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDoctorAccount,
  getDoctorServiceClient,
} from '@/lib/auth/doctor-account';
import { slotsOverlap, DEFAULT_SLOT_DURATION_MIN, CONFLICT_WINDOW_MS } from '@/lib/slots';

export const dynamic = 'force-dynamic';

/** GET /api/doctor/availability?from=&to= — the signed-in doctor's own slots. */
export async function GET(request: NextRequest) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account || !account.doctor_id) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const supabase = getDoctorServiceClient();
  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('doctor_availability')
    .select('id, slot_datetime, duration_minutes, is_booked')
    .eq('doctor_id', account.doctor_id)
    .order('slot_datetime', { ascending: true });

  if (from) query = query.gte('slot_datetime', from);
  if (to) query = query.lte('slot_datetime', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ slots: data ?? [] });
}

/** POST /api/doctor/availability — add one open slot for the signed-in doctor. */
export async function POST(request: NextRequest) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account || !account.doctor_id) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const supabase = getDoctorServiceClient();
  const body = await request.json();

  const slotDatetime: string = body['slot_datetime'];
  const slotDate = new Date(slotDatetime);
  if (!slotDatetime || Number.isNaN(slotDate.getTime())) {
    return NextResponse.json({ error: 'التاريخ أو الوقت غير صحيح' }, { status: 400 });
  }

  const newStart = slotDate.getTime();
  if (newStart <= Date.now()) {
    return NextResponse.json({ error: 'لازم يكون الموعد في المستقبل' }, { status: 400 });
  }

  const durationMinutes = DEFAULT_SLOT_DURATION_MIN;

  // Reject a slot that overlaps an existing one.
  const { data: nearby, error: nearbyError } = await supabase
    .from('doctor_availability')
    .select('slot_datetime, duration_minutes')
    .eq('doctor_id', account.doctor_id)
    .gte('slot_datetime', new Date(newStart - CONFLICT_WINDOW_MS).toISOString())
    .lte('slot_datetime', new Date(newStart + CONFLICT_WINDOW_MS).toISOString());
  if (nearbyError) return NextResponse.json({ error: nearbyError.message }, { status: 500 });

  const conflict = (nearby ?? []).some((s) =>
    slotsOverlap(
      newStart,
      durationMinutes,
      new Date(s.slot_datetime as string).getTime(),
      (s.duration_minutes as number) ?? DEFAULT_SLOT_DURATION_MIN
    )
  );
  if (conflict) {
    return NextResponse.json({ error: 'الموعد ده متعارض مع موعد موجود' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('doctor_availability')
    .insert({
      doctor_id: account.doctor_id,
      slot_datetime: slotDatetime,
      duration_minutes: durationMinutes,
      is_booked: false,
      source: 'native',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slot: data }, { status: 201 });
}

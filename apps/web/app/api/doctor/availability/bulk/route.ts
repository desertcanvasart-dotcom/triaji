import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDoctorAccount,
  getDoctorServiceClient,
} from '@/lib/auth/doctor-account';
import {
  buildSlotDatetime,
  slotsOverlap,
  DEFAULT_SLOT_DURATION_MIN,
  CONFLICT_WINDOW_MS,
} from '@/lib/slots';

export const dynamic = 'force-dynamic';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** POST /api/doctor/availability/bulk — weekly schedule for the signed-in doctor. */
export async function POST(request: NextRequest) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account || !account.doctor_id) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const supabase = getDoctorServiceClient();
  const body = await request.json();

  const daysOfWeek: number[] = Array.isArray(body['days_of_week']) ? body['days_of_week'] : [];
  const times: string[] = Array.isArray(body['times']) ? body['times'] : [];
  const weeks: number = body['weeks'] ?? 4;

  if (daysOfWeek.length === 0 || times.length === 0) {
    return NextResponse.json({ error: 'اختار الأيام والمواعيد' }, { status: 400 });
  }
  if (weeks < 1 || weeks > 12) {
    return NextResponse.json({ error: 'عدد الأسابيع لازم يكون بين 1 و 12' }, { status: 400 });
  }

  // Generate candidates as floating clinic-local wall clocks (naive Z) with pure
  // UTC calendar math, so the result never depends on the server's timezone.
  const nowMs = Date.now();
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const candidates = new Map<string, number>();

  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(todayUtc + i * 86_400_000);
    if (!daysOfWeek.includes(day.getUTCDay())) continue;
    const dateStr = `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;
    for (const time of times) {
      if (!TIME_RE.test(time)) continue;
      const iso = buildSlotDatetime(dateStr, time);
      if (!iso) continue;
      if (new Date(iso).getTime() <= nowMs) continue;
      candidates.set(iso, DEFAULT_SLOT_DURATION_MIN);
    }
  }

  if (candidates.size === 0) {
    return NextResponse.json({ error: 'مفيش مواعيد صالحة للإضافة' }, { status: 400 });
  }

  const starts = Array.from(candidates.keys()).map((iso) => new Date(iso).getTime());
  const minStart = Math.min(...starts);
  const maxStart = Math.max(...starts);

  const { data: existing, error: existingError } = await supabase
    .from('doctor_availability')
    .select('slot_datetime, duration_minutes')
    .eq('doctor_id', account.doctor_id)
    .gte('slot_datetime', new Date(minStart - CONFLICT_WINDOW_MS).toISOString())
    .lte('slot_datetime', new Date(maxStart + CONFLICT_WINDOW_MS).toISOString());
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existingIntervals = (existing ?? []).map((s) => ({
    start: new Date(s.slot_datetime as string).getTime(),
    dur: (s.duration_minutes as number) ?? DEFAULT_SLOT_DURATION_MIN,
  }));

  const accepted: Array<{
    doctor_id: string;
    slot_datetime: string;
    duration_minutes: number;
    is_booked: boolean;
    source: string;
  }> = [];

  for (const [iso, dur] of candidates) {
    const start = new Date(iso).getTime();
    const clashesExisting = existingIntervals.some((e) => slotsOverlap(start, dur, e.start, e.dur));
    const clashesAccepted = accepted.some((a) =>
      slotsOverlap(start, dur, new Date(a.slot_datetime).getTime(), a.duration_minutes)
    );
    if (clashesExisting || clashesAccepted) continue;
    accepted.push({
      doctor_id: account.doctor_id,
      slot_datetime: iso,
      duration_minutes: dur,
      is_booked: false,
      source: 'native',
    });
  }

  const skipped = candidates.size - accepted.length;
  if (accepted.length === 0) {
    return NextResponse.json({ created: 0, skipped, message: `المواعيد موجودة بالفعل (${skipped})` });
  }

  const { data, error } = await supabase.from('doctor_availability').insert(accepted).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const created = data?.length ?? 0;
  return NextResponse.json(
    {
      created,
      skipped,
      message:
        skipped > 0
          ? `تمت إضافة ${created} موعد، وتخطّي ${skipped} (موجودين بالفعل)`
          : `تمت إضافة ${created} موعد`,
    },
    { status: 201 }
  );
}

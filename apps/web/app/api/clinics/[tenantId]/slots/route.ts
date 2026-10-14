import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { fetchTimeOff, isSlotBlocked } from '@/lib/time-off';
import { allowsSlotBooking, doctorBelongsToClinic, loadClinic } from '@/lib/clinic/public-clinic';
import { DEFAULT_SLOT_DURATION_MIN } from '@/lib/slots';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clinics/[tenantId]/slots?doctor_id=&days=7 — open slots for one of
 * the clinic's doctors, for the clinic's public booking page. Hides slots
 * inside the doctor's time off. Times are floating clinic-local wall clocks
 * (lib/slots.ts).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const doctorId = request.nextUrl.searchParams.get('doctor_id') ?? '';
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days') ?? 7) || 7, 1), 30);

  const supabase = createServerClient();

  const clinic = await loadClinic(supabase, tenantId);
  if (!clinic || !allowsSlotBooking(clinic.bookingMode)) {
    return NextResponse.json({ slots: [] });
  }
  if (!doctorId || !(await doctorBelongsToClinic(supabase, tenantId, doctorId))) {
    return NextResponse.json({ error: 'الطبيب غير موجود في العيادة دي' }, { status: 404 });
  }

  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);

  const { data, error } = await supabase
    .from('doctor_availability')
    .select('id, slot_datetime, duration_minutes')
    .eq('doctor_id', doctorId)
    .eq('is_booked', false)
    .gte('slot_datetime', now.toISOString())
    .lte('slot_datetime', until.toISOString())
    .order('slot_datetime', { ascending: true });

  if (error) {
    console.error('[clinics/slots] load failed:', error.message);
    return NextResponse.json({ error: 'تعذر تحميل المواعيد' }, { status: 500 });
  }

  const blocks = await fetchTimeOff(supabase, doctorId, now.toISOString(), until.toISOString());
  const rows = (data ?? []) as { id: string; slot_datetime: string; duration_minutes: number | null }[];

  const slots = rows
    .filter((r) => !isSlotBlocked(r.slot_datetime, r.duration_minutes, blocks))
    .map((r) => {
      const start = new Date(r.slot_datetime);
      const end = new Date(start.getTime() + (r.duration_minutes ?? DEFAULT_SLOT_DURATION_MIN) * 60_000);
      return { id: r.id, start_time: start.toISOString(), end_time: end.toISOString(), is_available: true };
    });

  return NextResponse.json({ slots });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
  const durationMinutes: number = body['duration_minutes'] ?? 30;

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

  const now = new Date();
  const slots: Array<{
    doctor_id: string;
    slot_datetime: string;
    duration_minutes: number;
    is_booked: boolean;
    source: string;
    tenant_id: string | null;
  }> = [];

  for (let w = 0; w < weeks; w++) {
    for (const dow of daysOfWeek) {
      // Find the next occurrence of this day of week
      const baseDate = new Date(now);
      baseDate.setDate(baseDate.getDate() + (7 * w));
      const currentDow = baseDate.getDay();
      const daysUntil = (dow - currentDow + 7) % 7;
      const targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() + daysUntil);

      if (targetDate <= now) continue;

      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        if (hours === undefined || minutes === undefined) continue;

        const slotDate = new Date(targetDate);
        slotDate.setHours(hours, minutes, 0, 0);

        if (slotDate <= now) continue;

        slots.push({
          doctor_id: id,
          slot_datetime: slotDate.toISOString(),
          duration_minutes: durationMinutes,
          is_booked: false,
          source: 'native',
          tenant_id: admin.tenant_id,
        });
      }
    }
  }

  if (slots.length === 0) {
    return NextResponse.json(
      { error: 'No valid future slots could be generated.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('doctor_availability')
    .insert(slots)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    created: data?.length ?? 0,
    message: `${data?.length ?? 0} slots created successfully.`,
  }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

interface AvailableSlot {
  id: string;
  slotDatetime: string;
  durationMinutes: number;
  dayAr: string;
  dateAr: string;
  timeAr: string;
}

function formatTimeAr(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const isPM = hours >= 12;
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ':00';
  return `${displayHour}${minuteStr} ${isPM ? 'مساءً' : 'صباحاً'}`;
}

function formatSlot(row: { id: string; slot_datetime: string; duration_minutes: number }): AvailableSlot {
  const dt = new Date(row.slot_datetime);
  const dayIndex = dt.getDay();
  const monthIndex = dt.getMonth();

  return {
    id: row.id as string,
    slotDatetime: row.slot_datetime as string,
    durationMinutes: row.duration_minutes as number,
    dayAr: ARABIC_DAYS[dayIndex] ?? '',
    dateAr: `${dt.getDate()} ${ARABIC_MONTHS[monthIndex] ?? ''}`,
    timeAr: formatTimeAr(dt),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  const { doctorId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(Number(searchParams.get('days') ?? 14), 30);

  const supabase = createServerClient();

  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { data, error } = await supabase
    .from('doctor_availability')
    .select('id, slot_datetime, duration_minutes')
    .eq('doctor_id', doctorId)
    .eq('is_booked', false)
    .gte('slot_datetime', now.toISOString())
    .lte('slot_datetime', endDate.toISOString())
    .order('slot_datetime', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const slots: AvailableSlot[] = (data ?? []).map((row) =>
    formatSlot(row as { id: string; slot_datetime: string; duration_minutes: number })
  );

  return NextResponse.json({ slots });
}

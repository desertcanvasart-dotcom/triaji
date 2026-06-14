import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccountRow {
  id: string;
  gp_video_calls_enabled: boolean;
  video_call_availability: Record<string, [string, string]> | null;
}

// Day mapping: JS getDay() → Arabic day keys
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// ─── GET /api/doctor/gp-availability ────────────────────────────────────────
// Check if a doctor is available for a GP video call right now.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorAccountId = searchParams.get('doctorAccountId');

    if (!doctorAccountId) {
      return NextResponse.json(
        { error: 'doctorAccountId is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // ── Load doctor settings ─────────────────────────────────────────────

    const { data: doctor } = await supabase
      .from('doctor_accounts')
      .select('id, gp_video_calls_enabled, video_call_availability')
      .eq('id', doctorAccountId)
      .single() as { data: DoctorAccountRow | null };

    if (!doctor) {
      return NextResponse.json({ error: 'الطبيب غير موجود' }, { status: 404 });
    }

    // ── Check if video calls are enabled ─────────────────────────────────

    if (!doctor.gp_video_calls_enabled) {
      return NextResponse.json({
        available: false,
        reason: 'مكالمات الفيديو غير متاحة لهذا الطبيب',
      });
    }

    // ── Check availability schedule ──────────────────────────────────────

    const availability = doctor.video_call_availability;

    // If no schedule set, assume always available (when enabled)
    if (!availability || Object.keys(availability).length === 0) {
      return NextResponse.json({ available: true });
    }

    // Cairo timezone (UTC+2)
    const now = new Date();
    const cairoOffset = 2 * 60; // +2 hours in minutes
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const cairoDate = new Date(utcMs + cairoOffset * 60000);

    const dayIndex = cairoDate.getDay();
    const dayKey = DAY_KEYS[dayIndex]!;
    const currentHour = cairoDate.getHours();
    const currentMinute = cairoDate.getMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    const todayWindow = availability[dayKey];

    if (!todayWindow) {
      // No availability today — find next window
      const nextWindow = findNextWindow(availability, dayIndex);
      return NextResponse.json({
        available: false,
        nextWindow,
        reason: 'الطبيب غير متاح اليوم',
      });
    }

    const [start, end] = todayWindow;

    if (currentTime >= start && currentTime <= end) {
      return NextResponse.json({ available: true });
    }

    // Not in current window
    if (currentTime < start) {
      return NextResponse.json({
        available: false,
        nextWindow: `اليوم ${start}`,
        reason: 'خارج ساعات العمل',
      });
    }

    // Past today's window — find next
    const nextWindow = findNextWindow(availability, dayIndex);
    return NextResponse.json({
      available: false,
      nextWindow,
      reason: 'خارج ساعات العمل',
    });
  } catch (err) {
    console.error('[GP Availability] Error:', err);
    return NextResponse.json({ error: 'فشل في التحقق من التوفر' }, { status: 500 });
  }
}

// ─── Find Next Availability Window ──────────────────────────────────────────

function findNextWindow(
  availability: Record<string, [string, string]>,
  currentDayIndex: number
): string | undefined {
  const dayNames: Record<string, string> = {
    sunday: 'الأحد',
    monday: 'الاثنين',
    tuesday: 'الثلاثاء',
    wednesday: 'الأربعاء',
    thursday: 'الخميس',
    friday: 'الجمعة',
    saturday: 'السبت',
  };

  for (let offset = 1; offset <= 7; offset++) {
    const checkIndex = (currentDayIndex + offset) % 7;
    const checkDay = DAY_KEYS[checkIndex]!;
    const window = availability[checkDay];

    if (window) {
      const dayNameAr = dayNames[checkDay] ?? checkDay;
      return `${dayNameAr} ${window[0]}`;
    }
  }

  return undefined;
}

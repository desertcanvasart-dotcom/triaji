import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

// POST /api/telehealth/call-events — update call start/end times
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    bookingId?: string;
    event?: 'call_started' | 'call_ended';
  };

  if (!body.bookingId || !body.event) {
    return NextResponse.json({ error: 'bookingId and event are required' }, { status: 400 });
  }

  const supabase = createServerClient();

  if (body.event === 'call_started') {
    await supabase
      .from('bookings')
      .update({ call_started_at: new Date().toISOString() })
      .eq('id', body.bookingId);
  } else if (body.event === 'call_ended') {
    // Get call_started_at to calculate duration
    const { data: booking } = await supabase
      .from('bookings')
      .select('call_started_at')
      .eq('id', body.bookingId)
      .single();

    const startedAt = booking?.call_started_at
      ? new Date(booking.call_started_at as string).getTime()
      : Date.now();
    const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);

    await supabase
      .from('bookings')
      .update({
        call_ended_at: new Date().toISOString(),
        call_duration_seconds: durationSeconds,
      })
      .eq('id', body.bookingId);
  }

  return NextResponse.json({ success: true });
}

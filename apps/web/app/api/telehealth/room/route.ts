import { NextRequest, NextResponse } from 'next/server';
import { createTelehealthRoom } from '@/lib/telehealth/room';

// POST /api/telehealth/room — create LiveKit room for a telehealth booking
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { bookingId?: string };

  if (!body.bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  try {
    const roomName = await createTelehealthRoom(body.bookingId);
    return NextResponse.json({ roomName, serverUrl: process.env.LIVEKIT_URL ?? '' });
  } catch (err) {
    console.error('[Telehealth] Room creation error:', err);
    return NextResponse.json({ error: 'فشل في إنشاء غرفة الاستشارة' }, { status: 500 });
  }
}

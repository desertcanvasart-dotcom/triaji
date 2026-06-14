import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Config ─────────────────────────────────────────────────────────────────

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

function isConfigured(): boolean {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface TokenBody {
  roomName: string;
  participantName: string;
  role: 'doctor' | 'patient';
}

// ─── POST /api/telehealth/gp-token ──────────────────────────────────────────
// Generate a LiveKit participant token for a GP video call.

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TokenBody;

    if (!body.roomName || !body.participantName || !body.role) {
      return NextResponse.json(
        { error: 'roomName, participantName, and role are required' },
        { status: 400 }
      );
    }

    if (!['doctor', 'patient'].includes(body.role)) {
      return NextResponse.json(
        { error: 'role must be "doctor" or "patient"' },
        { status: 400 }
      );
    }

    // ── DEV mode fallback ────────────────────────────────────────────────

    if (!isConfigured()) {
      console.log('[GP Video DEV_MODE] Would generate token for:', body.participantName, 'room:', body.roomName);
      return NextResponse.json({
        token: `dev-gp-token-${body.role}-${Date.now()}`,
        roomName: body.roomName,
        serverUrl: '',
      });
    }

    // ── Generate LiveKit access token ────────────────────────────────────

    const { AccessToken } = await import('livekit-server-sdk');
    const token = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
      identity: `gp-${body.role}-${body.participantName}`,
      name: body.participantName,
    });

    token.addGrant({
      room: body.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: body.role === 'doctor',
    });

    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      roomName: body.roomName,
      serverUrl: LIVEKIT_URL ?? '',
    });
  } catch (err) {
    console.error('[GP Video] Token generation error:', err);
    return NextResponse.json({ error: 'فشل في إنشاء رمز المكالمة' }, { status: 500 });
  }
}

/**
 * POST /api/session
 * Creates a new triage session or retrieves an existing one.
 *
 * Body: { patientId: string, tenantId?: string, channel?: string }
 * Returns: { session: TriageSession }
 *
 * GET /api/session?id=<sessionId>
 * Retrieves a session by ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/triage/session-manager';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      patientId?: string;
      tenantId?: string;
      channel?: 'app' | 'website_widget' | 'hospital_kiosk' | 'api';
    };

    const session = await createSession({
      patientId: body.patientId ?? null,
      tenantId: body.tenantId,
      channel: body.channel,
    });

    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required (pass ?id=<uuid>)' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

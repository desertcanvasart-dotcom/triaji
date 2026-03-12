/**
 * POST /api/chat
 * Main triage conversation handler.
 * Delegates to the orchestrator which coordinates:
 *   normalization → rules engine → RAG retrieval → Claude API → persistence
 *
 * Body: { sessionId: string, message: string }
 * Returns: OrchestratorResult
 */

import { NextRequest, NextResponse } from 'next/server';
import { handlePatientMessage } from '@/lib/triage/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      message?: string;
    };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!body.message || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    const result = await handlePatientMessage(body.sessionId, body.message.trim());

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Chat API error:', message);

    // Distinguish between known errors and unexpected ones
    if (message.includes('not found') || message.includes('not active')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

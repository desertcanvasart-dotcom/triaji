/**
 * GET /api/health-assistant/sessions/[id]
 * Load a single health assistant session with full messages.
 *
 * Auth: patient (cookie-based, own sessions only)
 * Returns: Full session object with messages array
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import type { AssistantMessage, FlaggedResponse } from '@triaji/shared/types';

import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: session, error } = await supabase
    .from('health_assistant_sessions')
    .select('id, patient_id, lang, messages, message_count, started_at, last_message_at, escalation_triggered, context_snapshot_at, flagged_responses, created_at')
    .eq('id', sessionId)
    .eq('patient_id', patient.patientId) // Ensure ownership
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    lang: session.lang,
    messages: (session.messages as AssistantMessage[]) ?? [],
    messageCount: session.message_count ?? 0,
    startedAt: session.started_at ?? session.created_at,
    lastMessageAt: session.last_message_at,
    escalationTriggered: session.escalation_triggered ?? false,
    contextSnapshotAt: session.context_snapshot_at,
    flaggedResponses: (session.flagged_responses as FlaggedResponse[]) ?? [],
    createdAt: session.created_at,
  });
}

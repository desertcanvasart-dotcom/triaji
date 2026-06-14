/**
 * GET /api/health-assistant/sessions
 * List a patient's health assistant sessions (last 90 days).
 *
 * Auth: patient (cookie-based)
 * Returns: Array of { id, firstMessage, messageCount, date }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import type { AssistantMessage } from '@triaji/shared/types';

import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

const SESSIONS_LOOKBACK_DAYS = 90;

export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SESSIONS_LOOKBACK_DAYS);

  const { data: sessions, error } = await supabase
    .from('health_assistant_sessions')
    .select('id, messages, message_count, created_at, last_message_at, lang, escalation_triggered')
    .eq('patient_id', patient.patientId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[HealthAssistant Sessions] Error:', error.message);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }

  const result = (sessions ?? []).map((session) => {
    const messages = (session.messages as AssistantMessage[]) ?? [];
    const firstUserMessage = messages.find((m) => m.role === 'user');
    const preview = firstUserMessage
      ? firstUserMessage.content.slice(0, 100) + (firstUserMessage.content.length > 100 ? '...' : '')
      : '';

    return {
      id: session.id,
      firstMessage: preview,
      messageCount: session.message_count ?? messages.length,
      date: session.created_at,
      lastMessageAt: session.last_message_at,
      lang: session.lang,
      escalated: session.escalation_triggered ?? false,
    };
  });

  return NextResponse.json({ sessions: result });
}

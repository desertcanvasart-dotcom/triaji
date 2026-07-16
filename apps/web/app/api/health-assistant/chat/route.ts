/**
 * POST /api/health-assistant/chat
 * Main health assistant conversation endpoint.
 * Streams responses via ReadableStream + Server-Sent Events.
 *
 * Auth: patient (cookie-based)
 * Body: { message: string, sessionId?: string, lang?: 'ar' | 'en' }
 *
 * SSE format:
 *   data: {"type":"text","content":"word"}
 *   data: {"type":"done","sessionId":"..."}
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@triaji/shared/supabase';
import type { AssistantMessage } from '@triaji/shared/types';

import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { loadAssistantContext } from '@/lib/health-assistant/context-loader';
import { buildSystemPrompt } from '@/lib/health-assistant/system-prompt';
import {
  runSafetyCheck,
  buildEscalationResponse,
  runPostResponseCheck,
} from '@/lib/health-assistant/safety';

export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 500;
const MAX_MESSAGES_PER_SESSION = 50;

// ─── Anthropic Client ───────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ─── SSE Helpers ────────────────────────────────────────────────────────────

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let body: { message?: string; sessionId?: string; lang?: 'ar' | 'en' };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message = body.message?.trim();
  if (!message || message.length === 0) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (message.length > 2000) {
    return new Response(JSON.stringify({ error: 'Message too long (max 2000 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = body.lang === 'en' ? 'en' : 'ar';
  const supabase = createServerClient();

  try {
    // ─── Load or Create Session ───────────────────────────────────────────
    let sessionId = body.sessionId;
    let existingMessages: AssistantMessage[] = [];

    if (sessionId) {
      // Load existing session — verify ownership
      const { data: session, error } = await supabase
        .from('health_assistant_sessions')
        .select('id, patient_id, messages, message_count, escalation_triggered')
        .eq('id', sessionId)
        .eq('patient_id', patient.patientId)
        .single();

      if (error || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (session.escalation_triggered) {
        return new Response(
          JSON.stringify({ error: 'Session was escalated. Please start a new conversation.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if ((session.message_count ?? 0) >= MAX_MESSAGES_PER_SESSION) {
        return new Response(
          JSON.stringify({ error: 'Session message limit reached. Please start a new conversation.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      existingMessages = (session.messages as AssistantMessage[]) ?? [];
    } else {
      // Create new session
      const { data: newSession, error } = await supabase
        .from('health_assistant_sessions')
        .insert({
          patient_id: patient.patientId,
          lang,
          messages: [],
          message_count: 0,
          escalation_triggered: false,
          flagged_responses: [],
          context_snapshot_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !newSession) {
        throw new Error('Failed to create session');
      }

      sessionId = newSession.id as string;
    }

    // ─── Load Context (cached) ────────────────────────────────────────────
    const context = await loadAssistantContext(patient.patientId, lang);

    // ─── Pre-Safety Check ─────────────────────────────────────────────────
    const safetyResult = runSafetyCheck(message, context);

    if (safetyResult.requiresEscalation && safetyResult.reason) {
      // Return escalation response without calling Claude
      const escalationText = buildEscalationResponse(safetyResult.reason, lang);
      const now = new Date().toISOString();

      // Save messages and mark session as escalated
      const updatedMessages: AssistantMessage[] = [
        ...existingMessages,
        { role: 'user', content: message, timestamp: now },
        { role: 'assistant', content: escalationText, timestamp: now },
      ];

      await supabase
        .from('health_assistant_sessions')
        .update({
          messages: updatedMessages,
          message_count: updatedMessages.length,
          last_message_at: now,
          escalation_triggered: true,
        })
        .eq('id', sessionId);

      // Return as SSE stream with the escalation response
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(sseEvent({ type: 'text', content: escalationText })));
          controller.enqueue(
            encoder.encode(sseEvent({ type: 'done', sessionId, escalation: true, reason: safetyResult.reason }))
          );
          controller.close();
        },
      });

      return new Response(stream, { headers: sseHeaders() });
    }

    // ─── Build Messages for Claude ────────────────────────────────────────
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of existingMessages) {
      claudeMessages.push({ role: msg.role, content: msg.content });
    }
    claudeMessages.push({ role: 'user', content: message });

    // ─── Stream from Claude ───────────────────────────────────────────────
    const anthropic = getAnthropicClient();
    const systemPrompt = buildSystemPrompt(context);
    const currentSessionId = sessionId;
    const currentMessageIndex = existingMessages.length + 1; // assistant message index

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullResponse = '';

        try {
          const messageStream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages: claudeMessages,
          });

          // Stream text tokens as SSE events
          messageStream.on('text', (text) => {
            fullResponse += text;
            controller.enqueue(encoder.encode(sseEvent({ type: 'text', content: text })));
          });

          // Wait for completion
          await messageStream.finalMessage();

          // Send done event
          controller.enqueue(
            encoder.encode(sseEvent({ type: 'done', sessionId: currentSessionId }))
          );
          controller.close();

          // ─── Post-Stream: Persist + Safety Check ──────────────────────
          const now = new Date().toISOString();
          const updatedMessages: AssistantMessage[] = [
            ...existingMessages,
            { role: 'user', content: message, timestamp: now },
            { role: 'assistant', content: fullResponse, timestamp: now },
          ];

          await supabase
            .from('health_assistant_sessions')
            .update({
              messages: updatedMessages,
              message_count: updatedMessages.length,
              last_message_at: now,
            })
            .eq('id', currentSessionId);

          // Post-response safety check (async, non-blocking)
          runPostResponseCheck(fullResponse, currentSessionId, currentMessageIndex).catch(
            (err) => console.error('[HealthAssistant] Post-response check failed:', err)
          );
        } catch (err) {
          console.error('[HealthAssistant] Stream error:', err);
          const errorMsg =
            lang === 'ar'
              ? 'عذرًا، حصل خطأ. حاول تاني.'
              : 'Sorry, an error occurred. Please try again.';
          controller.enqueue(encoder.encode(sseEvent({ type: 'error', content: errorMsg })));
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[HealthAssistant Chat] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/embed/event
 *
 * Called by the widget bundle — fire and forget.
 * Tracks widget engagement events for the analytics funnel.
 * Returns 204 No Content — widget does not wait for response.
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { corsJson, corsOptions } from '../../cors';

const VALID_EVENT_TYPES = new Set([
  'impression',
  'button_click',
  'session_start',
  'session_complete',
  'booking_started',
  'booking_confirmed',
]);

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, eventType, sessionId, pageUrl, referrer, userAgent } = body;

    if (!tenantId || !eventType) {
      return corsJson({ error: 'tenantId and eventType required' }, { status: 400 });
    }

    if (!VALID_EVENT_TYPES.has(eventType)) {
      return corsJson({ error: 'invalid eventType' }, { status: 400 });
    }

    const supabase = createServerClient();

    await supabase.from('widget_events').insert({
      tenant_id: tenantId,
      event_type: eventType,
      session_id: sessionId ?? null,
      page_url: pageUrl ?? null,
      referrer: referrer ?? null,
      user_agent: userAgent ?? null,
    });

    // Return 204 — widget does not wait for response
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch {
    // Never fail for analytics — return 204 anyway
    return new Response(null, { status: 204 });
  }
}

/**
 * POST /api/phone/callback-answer
 * Called by Twilio when the patient answers a callback call.
 *
 * Returns TwiML that:
 *   1. Greets the patient with a contextual message
 *   2. Waits for their response
 *   3. If they want help → connects to Media Stream for new triage session
 *   4. If voicemail/machine detected → hangs up gracefully
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { validateTwilioSignature, createPhoneSession } from '@/lib/phone/twilio';
import { markCallbackCompleted } from '@/lib/phone/callbacks';
import type { CallbackRecord } from '@/lib/phone/callbacks';

export async function POST(request: NextRequest) {
  try {
    // Validate Twilio signature
    const isValid = await validateTwilioSignature(request.clone());
    if (!isValid) {
      return new Response('Forbidden', { status: 403 });
    }

    const callbackId = request.nextUrl.searchParams.get('callbackId');
    if (!callbackId) {
      return new Response(buildHangupTwiml(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const formData = await request.formData();
    const answeredBy = formData.get('AnsweredBy') as string | null;
    const callerPhone = formData.get('To') as string | null;
    const callSid = formData.get('CallSid') as string | null;

    // If machine/voicemail detected, hang up — don't leave a message
    if (answeredBy && answeredBy !== 'human') {
      console.log(`[Callback Answer] Machine detected (${answeredBy}) for ${callbackId} — hanging up`);
      return new Response(buildHangupTwiml(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Load callback details
    const supabase = createServerClient();
    const { data: callback, error } = await supabase
      .from('callback_queue')
      .select('*')
      .eq('id', callbackId)
      .single();

    if (error || !callback) {
      console.error(`[Callback Answer] Callback not found: ${callbackId}`);
      return new Response(buildHangupTwiml(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const cb = callback as CallbackRecord;

    // Look up the original session's detected language for callback consistency
    let originalLang: 'ar' | 'en' = 'ar';
    let englishEnabled = false;

    if (cb.original_session_id) {
      const { data: origSession } = await supabase
        .from('triage_sessions')
        .select('detected_lang')
        .eq('id', cb.original_session_id)
        .single();
      if (origSession?.detected_lang === 'en') {
        originalLang = 'en';
      }
    }

    // Look up tenant's english_enabled setting
    if (cb.tenant_id) {
      const { data: tenantConfig } = await supabase
        .from('tenant_config')
        .select('english_enabled')
        .eq('tenant_id', cb.tenant_id)
        .single();
      englishEnabled = (tenantConfig?.english_enabled as boolean) ?? false;
    }

    // Create a new triage session for this callback
    const session = await createPhoneSession({
      tenantId: cb.tenant_id,
      callerPhone: callerPhone ?? cb.patient_phone,
      callSid: callSid ?? `callback-${callbackId}`,
    });

    // Mark callback as completed with the new session
    await markCallbackCompleted(callbackId, session.id);

    // Build contextual greeting in the same language as the original session
    const greetings = {
      missed_call: {
        ar: 'أهلاً، أنا نور من دكتور تريو. اتصلت بيك لأنك اتصلت بينا ومكناش متاحين. هل تحتاج مساعدة طبية؟',
        en: 'Hello, this is Nour from DoctorTrio. You called us earlier but we were unavailable. Do you need medical assistance?',
      },
      default: {
        ar: 'أهلاً، أنا نور من دكتور تريو. اتصلت بيك لأن خطنا انقطع. هل لازلت محتاج مساعدة؟',
        en: 'Hello, this is Nour from DoctorTrio. You called us earlier and we got disconnected. Can I help you?',
      },
    };

    const greetingKey = cb.trigger_reason === 'missed_call' ? 'missed_call' : 'default';
    const greeting = greetings[greetingKey][originalLang];

    // Build TwiML that connects to the Media Stream for triage
    const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] || 'https://app.doctortrio.online';
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    const twiml = buildCallbackStreamTwiml({
      baseUrl,
      wsUrl,
      greeting,
      sessionId: session.id,
      tenantId: cb.tenant_id ?? '',
      callerPhone: callerPhone ?? cb.patient_phone,
      callSid: callSid ?? '',
      englishEnabled,
    });

    console.log(`[Callback Answer] Patient answered callback ${callbackId} — new session ${session.id}`);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('[Callback Answer] Error:', err instanceof Error ? err.message : err);
    return new Response(buildHangupTwiml(), {
      status: 500,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

// ─── TwiML Builders ─────────────────────────────────────────────────────────

interface CallbackStreamTwimlParams {
  baseUrl: string;
  wsUrl: string;
  greeting: string;
  sessionId: string;
  tenantId: string;
  callerPhone: string;
  callSid: string;
  englishEnabled: boolean;
}

function buildCallbackStreamTwiml(params: CallbackStreamTwimlParams): string {
  const { baseUrl, wsUrl, greeting, sessionId, tenantId, callerPhone, callSid, englishEnabled } = params;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Recording
      recordingStatusCallback="${escapeXml(baseUrl)}/api/phone/recording-status"
      recordingChannels="dual"
    />
  </Start>
  <Connect>
    <Stream url="${escapeXml(wsUrl)}/api/phone/stream">
      <Parameter name="sessionId" value="${escapeXml(sessionId)}"/>
      <Parameter name="tenantId" value="${escapeXml(tenantId)}"/>
      <Parameter name="callerPhone" value="${escapeXml(callerPhone)}"/>
      <Parameter name="callSid" value="${escapeXml(callSid)}"/>
      <Parameter name="callbackGreeting" value="${escapeXml(greeting)}"/>
      <Parameter name="englishEnabled" value="${englishEnabled ? 'true' : 'false'}"/>
    </Stream>
  </Connect>
</Response>`;
}

function buildHangupTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

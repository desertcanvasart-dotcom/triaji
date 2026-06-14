/**
 * POST /api/phone/incoming
 * Twilio webhook called when a patient dials the clinic phone number.
 *
 * Flow:
 *   1. Validate Twilio request signature (403 if invalid)
 *   2. Parse form data: To (called number), From (caller), CallSid
 *   3. Look up the tenant by called phone number
 *   4. Create a phone triage session
 *   5. Return TwiML XML that:
 *      - Starts dual-channel recording with a status callback
 *      - Connects to the Twilio Media Stream WebSocket
 *      - Passes sessionId, tenantId, callerPhone, callSid as Stream parameters
 */

import {
  validateTwilioSignature,
  getTenantByPhoneNumber,
  createPhoneSession,
} from '@/lib/phone/twilio';
import { cancelCallbackForPhone } from '@/lib/phone/callbacks';

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // 1. Validate Twilio signature
    const isValid = await validateTwilioSignature(request.clone());
    if (!isValid) {
      console.warn('[Phone] Invalid Twilio signature — rejecting request');
      return new Response('Forbidden', { status: 403 });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const calledNumber = formData.get('To') as string | null;
    const callerPhone = formData.get('From') as string | null;
    const callSid = formData.get('CallSid') as string | null;

    if (!calledNumber || !callerPhone || !callSid) {
      console.error('[Phone] Missing required fields: To, From, or CallSid');
      return new Response(
        buildErrorTwiml('عذراً، حصل خطأ. من فضلك حاول مرة أخرى.'),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    console.log(`[Phone] Incoming call: ${callSid} from ${callerPhone} to ${calledNumber}`);

    // 3. Look up tenant by called phone number
    const tenant = await getTenantByPhoneNumber(calledNumber);

    if (!tenant) {
      console.warn(`[Phone] No tenant found for phone number: ${calledNumber}`);
    }

    // 4. Create phone triage session
    const session = await createPhoneSession({
      tenantId: tenant?.id ?? null,
      callerPhone,
      callSid,
    });

    console.log(`[Phone] Session created: ${session.id} for call ${callSid}`);

    // 5. Cancel any pending callbacks for this patient (they called back themselves)
    await cancelCallbackForPhone(callerPhone).catch((err) => {
      console.error('[Phone] Failed to cancel pending callbacks:', err);
    });

    // 6. Build TwiML response
    const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || 'https://app.triajji.com';
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    const twiml = buildStreamTwiml({
      baseUrl,
      wsUrl,
      sessionId: session.id,
      tenantId: tenant?.id ?? '',
      callerPhone,
      callSid,
      englishEnabled: tenant?.english_enabled ?? false,
    });

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Phone] Incoming call handler error:', message);

    return new Response(
      buildErrorTwiml('عذراً، الخدمة غير متاحة حالياً. من فضلك حاول لاحقاً.'),
      { status: 500, headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// ─── TwiML Builders ─────────────────────────────────────────────────────────

interface StreamTwimlParams {
  baseUrl: string;
  wsUrl: string;
  sessionId: string;
  tenantId: string;
  callerPhone: string;
  callSid: string;
  englishEnabled: boolean;
}

/**
 * Build TwiML that starts recording and connects to the Media Stream WebSocket.
 * Passes englishEnabled as a Stream parameter so CallSession knows
 * whether to use bilingual greeting and multi-language STT.
 */
function buildStreamTwiml(params: StreamTwimlParams): string {
  const { baseUrl, wsUrl, sessionId, tenantId, callerPhone, callSid, englishEnabled } = params;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Recording
      recordingStatusCallback="${escapeXml(baseUrl)}/api/phone/recording-status"
      recordingChannels="dual"
    />
  </Start>
  <Connect action="${escapeXml(baseUrl)}/api/phone/status">
    <Stream url="${escapeXml(wsUrl)}/api/phone/stream">
      <Parameter name="sessionId" value="${escapeXml(sessionId)}"/>
      <Parameter name="tenantId" value="${escapeXml(tenantId)}"/>
      <Parameter name="callerPhone" value="${escapeXml(callerPhone)}"/>
      <Parameter name="callSid" value="${escapeXml(callSid)}"/>
      <Parameter name="englishEnabled" value="${englishEnabled ? 'true' : 'false'}"/>
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Build a TwiML error response that says a message and hangs up.
 */
function buildErrorTwiml(messageAr: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-EG" voice="Polly.Hala">${escapeXml(messageAr)}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Escape special XML characters to prevent injection in TwiML.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

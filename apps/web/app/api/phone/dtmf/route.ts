/**
 * POST /api/phone/dtmf
 * Alternative DTMF handler for Twilio's TwiML <Gather> verb.
 *
 * This route is used as a fallback when handling DTMF via the TwiML
 * <Gather action="/api/phone/dtmf"> pattern instead of WebSocket-based
 * DTMF (which is the primary method via Media Streams).
 *
 * Use cases:
 *   - IVR menu before Media Stream connection
 *   - Fallback for environments where WebSocket DTMF is unreliable
 *   - Simple digit-based routing without streaming
 *
 * DTMF Menu:
 *   1 = فحص ذكي بالصوت (Voice triage)
 *   2 = تحويل لموظف (Transfer to human agent)
 *   9 = إعادة القائمة (Replay menu)
 */

import { validateTwilioSignature } from '@/lib/phone/twilio';

// ─── Types ──────────────────────────────────────────────────────────────────

type DtmfDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#';

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Validate Twilio signature
    const isValid = await validateTwilioSignature(request.clone());
    if (!isValid) {
      console.warn('[DTMF] Invalid Twilio signature — rejecting request');
      return new Response('Forbidden', { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const digits = (formData.get('Digits') as string | null) ?? '';
    const callSid = formData.get('CallSid') as string | null;

    console.log(`[DTMF] Received digits="${digits}" for call=${callSid ?? 'unknown'}`);

    // Route based on digit pressed
    const digit = digits.charAt(0) as DtmfDigit;
    const twiml = buildDtmfResponse(digit);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[DTMF] Handler error:', message);

    return new Response(
      buildTwiml(
        '<Say language="ar-EG" voice="Polly.Hala">عذراً، حصل خطأ. من فضلك حاول مرة أخرى.</Say><Hangup/>'
      ),
      { status: 500, headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// ─── DTMF Response Builder ──────────────────────────────────────────────────

function buildDtmfResponse(digit: DtmfDigit): string {
  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || 'https://app.triajji.com';
  const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

  switch (digit) {
    // Option 1: Voice triage — connect to Media Stream
    case '1': {
      return buildTwiml(`
  <Say language="ar-EG" voice="Polly.Hala">جاري توصيلك بالفحص الذكي. من فضلك اوصف أعراضك بعد الصافرة.</Say>
  <Start>
    <Recording
      recordingStatusCallback="${escapeXml(baseUrl)}/api/phone/recording-status"
      recordingChannels="dual"
    />
  </Start>
  <Connect>
    <Stream url="${escapeXml(wsUrl)}/api/phone/stream">
      <Parameter name="callSid" value=""/>
    </Stream>
  </Connect>`);
    }

    // Option 2: Transfer to human agent
    case '2': {
      const agentNumber = process.env.HUMAN_AGENT_PHONE || '+201000000000';
      return buildTwiml(`
  <Say language="ar-EG" voice="Polly.Hala">جاري تحويلك لموظف خدمة العملاء. من فضلك استنى لحظة.</Say>
  <Dial callerId="${escapeXml(baseUrl)}">
    <Number>${escapeXml(agentNumber)}</Number>
  </Dial>`);
    }

    // Option 9: Replay the menu
    case '9': {
      return buildMenuTwiml(baseUrl);
    }

    // Unrecognised digit — replay the menu with a gentle prompt
    default: {
      return buildTwiml(`
  <Say language="ar-EG" voice="Polly.Hala">لم نتعرف على اختيارك.</Say>
  ${buildGatherInner(baseUrl)}`);
    }
  }
}

/**
 * Build the initial IVR menu TwiML with <Gather>.
 */
function buildMenuTwiml(baseUrl: string): string {
  return buildTwiml(buildGatherInner(baseUrl));
}

/**
 * Build the <Gather> portion of the menu TwiML.
 */
function buildGatherInner(baseUrl: string): string {
  return `
  <Gather action="${escapeXml(baseUrl)}/api/phone/dtmf" method="POST" numDigits="1" timeout="10">
    <Say language="ar-EG" voice="Polly.Hala">
      أهلاً بيك في ترياچي.
      لو عايز فحص ذكي بالصوت، اضغط واحد.
      لو عايز تتكلم مع موظف، اضغط اتنين.
      لو عايز تسمع القائمة تاني، اضغط تسعة.
    </Say>
  </Gather>
  <Say language="ar-EG" voice="Polly.Hala">لم نسمع اختيارك. جاري توصيلك بالفحص الذكي.</Say>
  <Redirect>${escapeXml(baseUrl)}/api/phone/incoming</Redirect>`;
}

// ─── TwiML Helpers ──────────────────────────────────────────────────────────

function buildTwiml(innerXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>${innerXml}
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

/**
 * POST /api/phone/callback-status
 * Twilio status callback for outbound callback calls.
 *
 * Called by Twilio with the final status of the callback call:
 *   - completed: patient answered (handled by callback-answer)
 *   - no-answer: patient didn't pick up
 *   - busy: patient's line busy
 *   - failed: call couldn't connect
 *   - canceled: call was canceled
 *
 * On failure, either reschedules or triggers WhatsApp fallback.
 */

import { validateTwilioSignature } from '@/lib/phone/twilio';
import { handleCallbackResult } from '@/lib/phone/callbacks';

export async function POST(request: Request) {
  try {
    // Validate Twilio signature
    const isValid = await validateTwilioSignature(request.clone());
    if (!isValid) {
      return new Response('Forbidden', { status: 403 });
    }

    const url = new URL(request.url);
    const callbackId = url.searchParams.get('callbackId');

    if (!callbackId) {
      return new Response('Missing callbackId', { status: 400 });
    }

    const formData = await request.formData();
    const callStatus = formData.get('CallStatus') as string | null;
    const callSid = formData.get('CallSid') as string | null;

    if (!callStatus) {
      return new Response('Missing CallStatus', { status: 400 });
    }

    console.log(
      `[Callback Status] callbackId=${callbackId} callSid=${callSid} status=${callStatus}`
    );

    await handleCallbackResult(callbackId, callStatus);

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[Callback Status] Error:', err instanceof Error ? err.message : err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

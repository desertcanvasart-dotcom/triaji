/**
 * POST /api/phone/status
 * Twilio call status callback — called when a call ends.
 *
 * When the call ends with 'no-answer', 'busy', or 'failed',
 * schedules a callback for the patient (missed call trigger).
 *
 * This is the Trigger 3 for missed call callbacks.
 */

import { validateTwilioSignature, getTenantByPhoneNumber } from '@/lib/phone/twilio';
import { scheduleCallback, cancelCallbackForPhone } from '@/lib/phone/callbacks';

export async function POST(request: Request) {
  try {
    // Validate Twilio signature
    const isValid = await validateTwilioSignature(request.clone());
    if (!isValid) {
      return new Response('Forbidden', { status: 403 });
    }

    const formData = await request.formData();
    const callStatus = formData.get('CallStatus') as string | null;
    const callerPhone = formData.get('From') as string | null;
    const calledNumber = formData.get('To') as string | null;
    const callSid = formData.get('CallSid') as string | null;

    if (!callStatus || !callerPhone) {
      return new Response('Missing fields', { status: 400 });
    }

    console.log(`[Phone Status] CallSid=${callSid} Status=${callStatus} From=${callerPhone}`);

    // If the call was completed normally, cancel any pending callbacks
    // (patient completed the session successfully)
    if (callStatus === 'completed') {
      await cancelCallbackForPhone(callerPhone);
      return new Response('OK', { status: 200 });
    }

    // Schedule callback for missed/failed calls
    if (['no-answer', 'busy', 'failed'].includes(callStatus)) {
      // Look up tenant from the called number
      let tenantId: string | null = null;
      if (calledNumber) {
        const tenant = await getTenantByPhoneNumber(calledNumber);
        tenantId = tenant?.id ?? null;
      }

      await scheduleCallback({
        tenantId,
        patientPhone: callerPhone,
        triggerReason: 'missed_call',
        scheduledFor: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes later
      });
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[Phone Status] Error:', err instanceof Error ? err.message : err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

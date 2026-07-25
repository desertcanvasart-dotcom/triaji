/**
 * SMS Gateway client for Egyptian carrier.
 * Generic REST-based client — gateway URL and API key via env vars.
 *
 * DEV_MODE: When SMS_GATEWAY_URL is not set, logs to console instead of sending.
 */

import { normaliseEgyptianPhone } from '../whatsapp/client';

export interface SMSResult {
  success: boolean;
  error?: string;
}

/**
 * Send an SMS via the configured Egyptian gateway.
 * In DEV_MODE (no gateway URL), logs to console.
 */
export async function sendSMS(
  to: string,
  message: string
): Promise<SMSResult> {
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const apiKey = process.env.SMS_GATEWAY_API_KEY;
  const senderName = process.env.SMS_SENDER_NAME ?? 'دكتور تريو';

  // DEV_MODE — log instead of sending
  if (!gatewayUrl || !apiKey) {
    console.log('[SMS DEV_MODE] Would send to:', to);
    console.log('[SMS DEV_MODE] Message:', message);
    return { success: true };
  }

  const normalised = normaliseEgyptianPhone(to);

  try {
    const res = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: normalised,
        from: senderName,
        message,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `SMS gateway error: ${errorText}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown SMS error',
    };
  }
}

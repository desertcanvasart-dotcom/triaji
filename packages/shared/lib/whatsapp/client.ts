/**
 * WhatsApp Business API client.
 * Uses the Meta Graph API directly — no third-party SDK.
 *
 * DEV_MODE: When WHATSAPP_API_TOKEN is not set, logs to console instead of sending.
 */

const WHATSAPP_API_VERSION = 'v18.0';

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Normalise Egyptian phone number to international format for WhatsApp.
 * WhatsApp requires country code without + prefix.
 *
 * 010XXXXXXXX  → 2010XXXXXXXX
 * 0020XXXXXXXX → 20XXXXXXXX
 * +2010XXXXXXXX → 2010XXXXXXXX
 * 2010XXXXXXXX → 2010XXXXXXXX (already correct)
 */
export function normaliseEgyptianPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Remove + prefix
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Remove 00 international prefix
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }

  // Add country code if starts with 0 (local Egyptian number)
  if (cleaned.startsWith('0')) {
    cleaned = '20' + cleaned.slice(1);
  }

  // Ensure starts with 20
  if (!cleaned.startsWith('20')) {
    cleaned = '20' + cleaned;
  }

  return cleaned;
}

/**
 * Mask a phone number for display: 010*****123
 */
export function maskPhone(phone: string): string {
  // Normalise to local format first
  let local = phone.replace(/[\s\-()]/g, '');
  if (local.startsWith('+')) local = local.slice(1);
  if (local.startsWith('00')) local = local.slice(2);
  if (local.startsWith('20')) local = '0' + local.slice(2);
  if (!local.startsWith('0')) local = '0' + local;

  if (local.length < 6) return local;
  const prefix = local.slice(0, 3);
  const suffix = local.slice(-3);
  const middle = '*'.repeat(Math.max(local.length - 6, 1));
  return `${prefix}${middle}${suffix}`;
}

/**
 * Send a WhatsApp text message via Meta Graph API.
 * In DEV_MODE (no token), logs to console.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // DEV_MODE — log instead of sending
  if (!token || !phoneNumberId) {
    console.log('[WhatsApp DEV_MODE] Would send to:', to);
    console.log('[WhatsApp DEV_MODE] Message:', message.slice(0, 200) + '...');
    return { success: true, messageId: `dev-wa-${Date.now()}` };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const normalised = normaliseEgyptianPhone(to);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalised,
        type: 'text',
        text: { body: message },
      }),
    });

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error?.message ?? `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown WhatsApp error',
    };
  }
}

/**
 * Send a WhatsApp document message via Meta Graph API.
 * Used for sending PDF clinical documents (prescriptions, lab orders, etc.)
 * In DEV_MODE (no token), logs to console.
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption: string
): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // DEV_MODE — log instead of sending
  if (!token || !phoneNumberId) {
    console.log('[WhatsApp DEV_MODE] Would send document to:', to);
    console.log('[WhatsApp DEV_MODE] Document:', filename);
    console.log('[WhatsApp DEV_MODE] Caption:', caption.slice(0, 200));
    return { success: true, messageId: `dev-wa-doc-${Date.now()}` };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const normalised = normaliseEgyptianPhone(to);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalised,
        type: 'document',
        document: {
          link: documentUrl,
          filename,
          caption,
        },
      }),
    });

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error?.message ?? `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown WhatsApp error',
    };
  }
}

/**
 * Clinical document WhatsApp message templates.
 */
export function clinicalDocumentCaption(
  type: 'prescription' | 'lab_order' | 'imaging_order' | 'consultation_summary',
  doctorName: string,
  docNumber: string,
  dateAr: string
): string {
  const templates: Record<string, string> = {
    prescription: `\u0623\u0631\u0633\u0644 \u0644\u0643 \u0627\u0644\u062F\u0643\u062A\u0648\u0631 ${doctorName} \u0631\u0648\u0634\u062A\u062A\u0643 \u0627\u0644\u0637\u0628\u064A\u0629 \uD83D\uDC8A\n\u0631\u0642\u0645 \u0627\u0644\u0631\u0648\u0634\u062A\u0629: ${docNumber} | \u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${dateAr}\n\u0627\u0644\u0631\u0648\u0634\u062A\u0629 \u0645\u0631\u0641\u0642\u0629. \u062A\u0631\u064A\u0627\u06C3\u064A \uD83C\uDFE5`,
    lab_order: `\u0623\u0631\u0633\u0644 \u0644\u0643 \u0627\u0644\u062F\u0643\u062A\u0648\u0631 ${doctorName} \u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \uD83E\uDDEA\n\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: ${docNumber} | \u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${dateAr}\n\u0627\u0644\u0637\u0644\u0628 \u0645\u0631\u0641\u0642. \u062A\u0631\u064A\u0627\u06C3\u064A \uD83C\uDFE5`,
    imaging_order: `\u0623\u0631\u0633\u0644 \u0644\u0643 \u0627\u0644\u062F\u0643\u062A\u0648\u0631 ${doctorName} \u0637\u0644\u0628 \u0627\u0644\u0623\u0634\u0639\u0629 \uD83D\uDCE1\n\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: ${docNumber} | \u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${dateAr}\n\u0627\u0644\u0637\u0644\u0628 \u0645\u0631\u0641\u0642. \u062A\u0631\u064A\u0627\u06C3\u064A \uD83C\uDFE5`,
    consultation_summary: `\u0623\u0631\u0633\u0644 \u0644\u0643 \u0627\u0644\u062F\u0643\u062A\u0648\u0631 ${doctorName} \u0645\u0644\u062E\u0635 \u0643\u0634\u0641\u0643 \uD83D\uDCCB\n\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${dateAr}\n\u0627\u0644\u0645\u0644\u062E\u0635 \u0645\u0631\u0641\u0642. \u062A\u0631\u064A\u0627\u06C3\u064A \uD83C\uDFE5`,
  };

  return templates[type] ?? '';
}

/**
 * WhatsApp Business API client.
 *
 * Provider-switchable via WHATSAPP_PROVIDER:
 *   - 'meta'   (default) — Meta Graph API directly (graph.facebook.com).
 *   - 'zernio'          — Zernio's WhatsApp API (https://zernio.com/api/v1),
 *                         which wraps the same WABA but exposes its own routes.
 *
 * DEV_MODE: when the selected provider's credentials are absent, both paths log
 * to the console instead of sending (so the app runs unconfigured as before).
 *
 * The public surface — sendWhatsAppMessage, sendWhatsAppDocument,
 * normaliseEgyptianPhone, maskPhone, clinicalDocumentCaption, WhatsAppResult —
 * is identical across providers, so callers never change.
 */

const WHATSAPP_API_VERSION = 'v18.0';
const ZERNIO_API_BASE_URL = process.env.ZERNIO_API_BASE_URL || 'https://zernio.com/api/v1';

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function whatsAppProvider(): 'zernio' | 'meta' {
  return process.env.WHATSAPP_PROVIDER?.toLowerCase() === 'zernio' ? 'zernio' : 'meta';
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

// ─── Public API (provider dispatch) ──────────────────────────────────────────

/**
 * Send a WhatsApp text message.
 * In DEV_MODE (provider creds absent), logs to console.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppResult> {
  return whatsAppProvider() === 'zernio'
    ? sendZernioText(to, message)
    : sendMetaText(to, message);
}

/**
 * Send a WhatsApp document message (PDF clinical documents, etc.).
 * In DEV_MODE (provider creds absent), logs to console.
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption: string
): Promise<WhatsAppResult> {
  return whatsAppProvider() === 'zernio'
    ? sendZernioDocument(to, documentUrl, filename, caption)
    : sendMetaDocument(to, documentUrl, filename, caption);
}

// ─── Meta Graph API provider ─────────────────────────────────────────────────

async function sendMetaText(to: string, message: string): Promise<WhatsAppResult> {
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

async function sendMetaDocument(
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

// ─── Zernio provider ─────────────────────────────────────────────────────────
//
// Zernio wraps the same WhatsApp Business Account but routes through its own
// unified-inbox API. A business-initiated message opens a conversation via
// POST /v1/inbox/conversations; the recipient phone goes in `participantId`
// (digits, country code, no '+'), and the response carries { messageId,
// conversationId }.

/** Pull a human-readable error out of Zernio's (string-or-object) error field. */
function zernioError(
  data: { error?: unknown; message?: unknown },
  status: number
): string {
  const e = data.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  if (typeof data.message === 'string') return data.message;
  return `HTTP ${status}`;
}

interface ZernioCreateConversationResponse {
  messageId?: string;
  conversationId?: string;
  error?: unknown;
  message?: unknown;
}

/**
 * Free-form (utility) text via Meta Direct Send — no template required. This
 * needs the connected WABA to be Direct-Send eligible; otherwise Meta rejects a
 * templateless business-initiated message (TEMPLATE_REQUIRED), which surfaces
 * here as a failed result.
 */
async function sendZernioText(to: string, message: string): Promise<WhatsAppResult> {
  const apiKey = process.env.ZERNIO_API_KEY;
  const accountId = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID;

  // DEV_MODE — log instead of sending
  if (!apiKey || !accountId) {
    console.log('[WhatsApp/Zernio DEV_MODE] Would send to:', to);
    console.log('[WhatsApp/Zernio DEV_MODE] Message:', message.slice(0, 200) + '...');
    return { success: true, messageId: `dev-wa-${Date.now()}` };
  }

  const participantId = normaliseEgyptianPhone(to);

  try {
    const res = await fetch(`${ZERNIO_API_BASE_URL}/inbox/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        participantId,
        category: 'utility',
        message,
      }),
    });

    const data = (await res.json()) as ZernioCreateConversationResponse;

    if (!res.ok || data.error) {
      return { success: false, error: zernioError(data, res.status) };
    }

    return { success: true, messageId: data.messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown WhatsApp error',
    };
  }
}

/**
 * Document (PDF) send. WhatsApp does not allow a proactive free-form document,
 * so on Zernio a business-initiated document rides on an approved media-header
 * template: set ZERNIO_WA_DOC_TEMPLATE_NAME (and optionally _LANG, default 'ar')
 * to that template, and the PDF is supplied per-send via `headerMedia`. The
 * caption is passed as the template's first body parameter. Inside the 24-hour
 * window a free-form document is possible via the send-message endpoint, but
 * these sends are proactive, so the template path is the correct one.
 */
async function sendZernioDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption: string
): Promise<WhatsAppResult> {
  const apiKey = process.env.ZERNIO_API_KEY;
  const accountId = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID;

  // DEV_MODE — log instead of sending
  if (!apiKey || !accountId) {
    console.log('[WhatsApp/Zernio DEV_MODE] Would send document to:', to);
    console.log('[WhatsApp/Zernio DEV_MODE] Document:', filename);
    console.log('[WhatsApp/Zernio DEV_MODE] Caption:', caption.slice(0, 200));
    return { success: true, messageId: `dev-wa-doc-${Date.now()}` };
  }

  const templateName = process.env.ZERNIO_WA_DOC_TEMPLATE_NAME;
  const templateLanguage = process.env.ZERNIO_WA_DOC_TEMPLATE_LANG || 'ar';

  if (!templateName) {
    return {
      success: false,
      error:
        'Zernio WhatsApp document send needs an approved media-header template ' +
        '(set ZERNIO_WA_DOC_TEMPLATE_NAME); WhatsApp does not permit proactive ' +
        'free-form documents.',
    };
  }

  const participantId = normaliseEgyptianPhone(to);

  try {
    const res = await fetch(`${ZERNIO_API_BASE_URL}/inbox/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        participantId,
        templateName,
        templateLanguage,
        templateParams: [caption],
        headerMedia: {
          type: 'document',
          link: documentUrl,
          filename,
        },
      }),
    });

    const data = (await res.json()) as ZernioCreateConversationResponse;

    if (!res.ok || data.error) {
      return { success: false, error: zernioError(data, res.status) };
    }

    return { success: true, messageId: data.messageId };
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
    prescription: `أرسل لك الدكتور ${doctorName} روشتتك الطبية 💊\nرقم الروشتة: ${docNumber} | التاريخ: ${dateAr}\nالروشتة مرفقة. دكتور تريو 🏥`,
    lab_order: `أرسل لك الدكتور ${doctorName} طلب التحاليل 🧪\nرقم الطلب: ${docNumber} | التاريخ: ${dateAr}\nالطلب مرفق. دكتور تريو 🏥`,
    imaging_order: `أرسل لك الدكتور ${doctorName} طلب الأشعة 📡\nرقم الطلب: ${docNumber} | التاريخ: ${dateAr}\nالطلب مرفق. دكتور تريو 🏥`,
    consultation_summary: `أرسل لك الدكتور ${doctorName} ملخص كشفك 📋\nالتاريخ: ${dateAr}\nالملخص مرفق. دكتور تريو 🏥`,
  };

  return templates[type] ?? '';
}

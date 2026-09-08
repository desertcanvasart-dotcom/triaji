/**
 * Transactional email client (Resend).
 * Dependency-free — talks to the Resend REST API over fetch, like the SMS and
 * WhatsApp clients, so it works in the web app and the admin panel alike.
 *
 * DEV_MODE: when RESEND_API_KEY is not set, logs to console instead of sending.
 * Configure `EMAIL_FROM` with an address on a domain verified in Resend.
 */

export interface EmailResult {
  success: boolean;
  error?: string;
}

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback; derived from `html` when omitted. */
  text?: string;
}

const DEFAULT_FROM = 'دكتور تريو <noreply@doctortrio.online>';

/** Send a transactional email via Resend. */
export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  // DEV_MODE — log instead of sending
  if (!apiKey) {
    console.log('[Email DEV_MODE] Would send to:', input.to);
    console.log('[Email DEV_MODE] Subject:', input.subject);
    return { success: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Resend error: ${errorText}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}

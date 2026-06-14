/**
 * Twilio Integration
 * Signature validation, client initialization, tenant phone lookup,
 * session creation and reference code generation for phone calls.
 *
 * DEV_MODE: When TWILIO_AUTH_TOKEN is not set, validation passes
 * and the client returns a safe mock.
 */

import twilio from 'twilio';
import { createServerClient } from '@triaji/shared/supabase';
import { createSession } from '@/lib/triage/session-manager';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TenantPhoneInfo {
  id: string;
  human_agent_number: string | null;
  english_enabled: boolean;
}

interface PhoneSessionResult {
  id: string;
}

// ─── Twilio Signature Validation ────────────────────────────────────────────

/**
 * Validate an incoming Twilio webhook request signature.
 * In DEV_MODE (no TWILIO_AUTH_TOKEN), always returns true with a console log.
 */
export async function validateTwilioSignature(request: Request): Promise<boolean> {
  const authToken = process.env['TWILIO_AUTH_TOKEN'];

  if (!authToken) {
    console.log('[Twilio DEV_MODE] Skipping signature validation — no TWILIO_AUTH_TOKEN set');
    return true;
  }

  const signature = request.headers.get('X-Twilio-Signature');
  if (!signature) {
    console.warn('[Twilio] Missing X-Twilio-Signature header');
    return false;
  }

  // Clone the request to read the body without consuming it
  const cloned = request.clone();
  const formData = await cloned.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  const url = request.url;
  const isValid = twilio.validateRequest(authToken, signature, url, params);

  if (!isValid) {
    console.warn('[Twilio] Invalid signature for URL:', url);
  }

  return isValid;
}

// ─── Twilio Client Singleton ────────────────────────────────────────────────

let twilioClientInstance: twilio.Twilio | null = null;

/**
 * Get a Twilio client instance (lazy singleton).
 * In DEV_MODE (no credentials), returns a minimal mock that logs calls.
 */
export function getTwilioClient(): twilio.Twilio {
  if (twilioClientInstance) {
    return twilioClientInstance;
  }

  const accountSid = process.env['TWILIO_ACCOUNT_SID'];
  const authToken = process.env['TWILIO_AUTH_TOKEN'];

  if (!accountSid || !authToken) {
    console.log('[Twilio DEV_MODE] Using mock client — no TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN set');

    // Return a proxy that logs all method calls and returns resolved promises
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop: string) {
        if (prop === 'calls') {
          return new Proxy({} as Record<string, unknown>, {
            get(_callTarget, callProp: string) {
              if (callProp === 'create') {
                return (params: Record<string, unknown>) => {
                  console.log('[Twilio DEV_MODE] calls.create:', JSON.stringify(params).slice(0, 200));
                  return Promise.resolve({ sid: `dev-call-${Date.now()}` });
                };
              }
              // For calls(sid).update(...)
              return (sid: string) => ({
                update: (params: Record<string, unknown>) => {
                  console.log(`[Twilio DEV_MODE] calls(${sid}).update:`, JSON.stringify(params).slice(0, 200));
                  return Promise.resolve({ sid });
                },
              });
            },
          });
        }
        return undefined;
      },
    };

    twilioClientInstance = new Proxy({} as Record<string, unknown>, handler) as unknown as twilio.Twilio;
    return twilioClientInstance;
  }

  twilioClientInstance = twilio(accountSid, authToken);
  return twilioClientInstance;
}

// ─── Tenant Lookup by Phone Number ──────────────────────────────────────────

/**
 * Look up a tenant by their configured phone number in tenant_config.
 * Returns the tenant ID and optional human agent phone number.
 */
export async function getTenantByPhoneNumber(
  phoneNumber: string
): Promise<TenantPhoneInfo | null> {
  const supabase = createServerClient();

  // Normalize the phone number by stripping common formatting
  const cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');

  const { data, error } = await supabase
    .from('tenant_config')
    .select('tenant_id, human_agent_number, english_enabled')
    .eq('phone_number', cleanPhone)
    .eq('phone_number_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[Twilio] Failed to lookup tenant by phone:', error.message);
    return null;
  }

  return {
    id: data.tenant_id as string,
    human_agent_number: (data.human_agent_number as string) ?? null,
    english_enabled: (data.english_enabled as boolean) ?? false,
  };
}

// ─── Phone Session Creation ─────────────────────────────────────────────────

/**
 * Create a triage session specifically for a phone call.
 * Sets channel to 'phone_call' and records the call SID.
 */
export async function createPhoneSession(input: {
  tenantId: string | null;
  callerPhone: string;
  callSid: string;
}): Promise<PhoneSessionResult> {
  const supabase = createServerClient();

  // Create or find patient by phone number
  let patientId: string | null = null;
  const cleanPhone = input.callerPhone.replace(/[\s\-()]/g, '');
  const { data: existingPatient } = await supabase
    .from('patients')
    .select('id')
    .eq('phone_number', cleanPhone)
    .single();

  if (existingPatient) {
    patientId = existingPatient.id as string;
  }

  const session = await createSession({
    patientId,
    tenantId: input.tenantId ?? undefined,
    channel: 'phone_call',
  });

  // Save call_sid to the session
  const { error } = await supabase
    .from('triage_sessions')
    .update({ call_sid: input.callSid })
    .eq('id', session.id);

  if (error) {
    console.error('[Phone] Failed to save call_sid:', error.message);
  }

  return { id: session.id };
}

// ─── Short Reference Code ───────────────────────────────────────────────────

/**
 * Generate a short reference code for phone calls.
 * Format: "TR-XXXX" where X is a hex character (uppercase).
 * Used to identify calls in WhatsApp summaries and agent handoff.
 *
 * @example "TR-A3F7", "TR-0B1E"
 */
export function generateShortRef(): string {
  const hex = Math.floor(Math.random() * 0xFFFF)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `TR-${hex}`;
}

/**
 * Callback Queue Management
 *
 * Handles scheduling, deduplication, and execution of patient callbacks.
 * When a patient hangs up mid-triage, has no audio, or misses a call,
 * Triajji proactively calls them back after a configurable delay.
 *
 * Callback lifecycle:
 *   1. Trigger detected (stream close, no audio, missed call)
 *   2. scheduleCallback() — checks dedup, inserts into callback_queue
 *   3. Cron job picks up scheduled callbacks every 2 minutes
 *   4. Outbound Twilio call initiated
 *   5. Patient answers → new triage session created (callback-answer webhook)
 *   6. Patient doesn't answer → reschedule or WhatsApp fallback
 */

import { createServerClient } from '@triaji/shared/supabase';
import { getTwilioClient } from './twilio';
import { normaliseEgyptianPhone, sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CallbackTriggerReason = 'incomplete_session' | 'no_audio' | 'missed_call';

export type CallbackStatus =
  | 'scheduled'
  | 'attempting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'whatsapp_sent';

export interface ScheduleCallbackInput {
  tenantId: string | null;
  patientPhone: string;
  originalSessionId?: string;
  triggerReason: CallbackTriggerReason;
  scheduledFor: Date;
}

export interface CallbackRecord {
  id: string;
  tenant_id: string | null;
  patient_phone: string;
  original_session_id: string | null;
  trigger_reason: CallbackTriggerReason;
  status: CallbackStatus;
  attempt_count: number;
  max_attempts: number;
  scheduled_for: string;
  last_attempted_at: string | null;
  completed_at: string | null;
  new_session_id: string | null;
  twilio_call_sid: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Schedule a Callback ────────────────────────────────────────────────────

/**
 * Schedule a callback for a patient.
 * Performs deduplication: if an active callback already exists for this phone,
 * the new one is silently skipped.
 */
export async function scheduleCallback(input: ScheduleCallbackInput): Promise<string | null> {
  const supabase = createServerClient();
  const cleanPhone = input.patientPhone.replace(/[\s\-()]/g, '');

  // Deduplication: check for existing active callback for this phone
  const { data: existing } = await supabase
    .from('callback_queue')
    .select('id')
    .eq('patient_phone', cleanPhone)
    .in('status', ['scheduled', 'attempting'])
    .maybeSingle();

  if (existing) {
    console.log(`[Callback] Skipping duplicate for ${cleanPhone} — already queued (${existing.id})`);
    return null;
  }

  const { data, error } = await supabase
    .from('callback_queue')
    .insert({
      tenant_id: input.tenantId,
      patient_phone: cleanPhone,
      original_session_id: input.originalSessionId ?? null,
      trigger_reason: input.triggerReason,
      status: 'scheduled',
      scheduled_for: input.scheduledFor.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Callback] Failed to schedule callback:', error.message);
    return null;
  }

  console.log(
    `[Callback] Scheduled for ${cleanPhone} (${input.triggerReason}) at ${input.scheduledFor.toISOString()} — id=${data.id}`
  );

  return data.id as string;
}

// ─── Process Due Callbacks ──────────────────────────────────────────────────

/**
 * Process callbacks that are due for execution.
 * Called by the cron job every 2 minutes.
 * Processes max 10 callbacks per run to avoid timeouts.
 */
export async function processDueCallbacks(): Promise<{
  processed: number;
  called: number;
  whatsappSent: number;
  errors: number;
}> {
  const supabase = createServerClient();
  const stats = { processed: 0, called: 0, whatsappSent: 0, errors: 0 };

  // Find callbacks that are due
  const { data: callbacks, error } = await supabase
    .from('callback_queue')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(10);

  if (error) {
    console.error('[Callback Cron] Failed to fetch due callbacks:', error.message);
    return stats;
  }

  if (!callbacks || callbacks.length === 0) {
    return stats;
  }

  console.log(`[Callback Cron] Processing ${callbacks.length} due callback(s)`);

  for (const cb of callbacks as CallbackRecord[]) {
    stats.processed++;

    try {
      // Check if max attempts reached → WhatsApp fallback
      if (cb.attempt_count >= cb.max_attempts) {
        await sendWhatsAppFallback(cb);
        stats.whatsappSent++;
        continue;
      }

      // Initiate outbound call
      await initiateCallbackCall(cb);
      stats.called++;
    } catch (err) {
      stats.errors++;
      console.error(`[Callback Cron] Error processing callback ${cb.id}:`, err);

      // Mark as failed on unexpected errors
      await supabase
        .from('callback_queue')
        .update({
          notes: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
        })
        .eq('id', cb.id);
    }
  }

  return stats;
}

// ─── Initiate Outbound Call ─────────────────────────────────────────────────

/**
 * Initiate a Twilio outbound call to the patient.
 */
async function initiateCallbackCall(callback: CallbackRecord): Promise<void> {
  const supabase = createServerClient();
  const client = getTwilioClient();

  const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] || 'https://app.triajji.com';
  const fromNumber = process.env['TWILIO_PHONE_NUMBER'];

  if (!fromNumber) {
    console.error('[Callback] TWILIO_PHONE_NUMBER not set — cannot initiate callback');
    return;
  }

  // Update status to attempting
  await supabase
    .from('callback_queue')
    .update({
      status: 'attempting',
      attempt_count: callback.attempt_count + 1,
      last_attempted_at: new Date().toISOString(),
    })
    .eq('id', callback.id);

  try {
    const call = await client.calls.create({
      to: normaliseEgyptianPhone(callback.patient_phone),
      from: fromNumber,
      url: `${baseUrl}/api/phone/callback-answer?callbackId=${encodeURIComponent(callback.id)}`,
      statusCallback: `${baseUrl}/api/phone/callback-status?callbackId=${encodeURIComponent(callback.id)}`,
      machineDetection: 'Enable',
      timeout: 30,
    });

    // Save Twilio call SID
    await supabase
      .from('callback_queue')
      .update({ twilio_call_sid: call.sid })
      .eq('id', callback.id);

    console.log(`[Callback] Outbound call initiated: ${call.sid} for callback ${callback.id}`);
  } catch (err) {
    console.error(`[Callback] Failed to initiate call for ${callback.id}:`, err);

    // Determine if we should retry or WhatsApp fallback
    const newAttemptCount = callback.attempt_count + 1;

    if (newAttemptCount >= callback.max_attempts) {
      await sendWhatsAppFallback(callback);
    } else {
      // Reschedule for 30 minutes later
      await supabase
        .from('callback_queue')
        .update({
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .eq('id', callback.id);
    }
  }
}

// ─── Handle Callback Result ─────────────────────────────────────────────────

/**
 * Handle the result of a callback attempt.
 * Called by the callback-status webhook when Twilio reports the call status.
 */
export async function handleCallbackResult(
  callbackId: string,
  callStatus: string
): Promise<void> {
  const supabase = createServerClient();

  const { data: callback, error } = await supabase
    .from('callback_queue')
    .select('*')
    .eq('id', callbackId)
    .single();

  if (error || !callback) {
    console.error(`[Callback] Callback not found: ${callbackId}`);
    return;
  }

  const cb = callback as CallbackRecord;

  // Patient answered — mark as completed (session creation handled by callback-answer)
  if (['completed', 'in-progress'].includes(callStatus)) {
    // Status will be finalized by the callback-answer webhook
    return;
  }

  // Voicemail / machine detected — don't leave a message, count as failed attempt
  if (callStatus === 'machine_start' || callStatus === 'machine_end_beep') {
    console.log(`[Callback] Voicemail detected for ${callbackId} — not leaving message`);
  }

  // No answer, busy, or failed
  if (['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
    if (cb.attempt_count >= cb.max_attempts) {
      // All attempts exhausted → WhatsApp fallback
      await sendWhatsAppFallback(cb);
    } else {
      // Reschedule for 30 minutes later
      await supabase
        .from('callback_queue')
        .update({
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .eq('id', callbackId);

      console.log(`[Callback] Rescheduled ${callbackId} for 30min later (attempt ${cb.attempt_count}/${cb.max_attempts})`);
    }
  }
}

/**
 * Mark a callback as completed when the patient answers and engages.
 */
export async function markCallbackCompleted(
  callbackId: string,
  newSessionId?: string
): Promise<void> {
  const supabase = createServerClient();

  await supabase
    .from('callback_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      new_session_id: newSessionId ?? null,
    })
    .eq('id', callbackId);

  console.log(`[Callback] Marked ${callbackId} as completed`);
}

/**
 * Cancel a pending callback (e.g., when the patient calls back themselves).
 */
export async function cancelCallbackForPhone(patientPhone: string): Promise<void> {
  const supabase = createServerClient();
  const cleanPhone = patientPhone.replace(/[\s\-()]/g, '');

  const { data, error } = await supabase
    .from('callback_queue')
    .update({ status: 'cancelled', notes: 'Patient called back before callback fired' })
    .eq('patient_phone', cleanPhone)
    .in('status', ['scheduled', 'attempting'])
    .select('id');

  if (!error && data && data.length > 0) {
    console.log(`[Callback] Cancelled ${data.length} pending callback(s) for ${cleanPhone}`);
  }
}

// ─── WhatsApp Fallback ──────────────────────────────────────────────────────

/**
 * Send WhatsApp fallback message after all callback attempts fail.
 */
async function sendWhatsAppFallback(callback: CallbackRecord): Promise<void> {
  const supabase = createServerClient();

  // Build the tenant chat URL
  const chatUrl = callback.tenant_id
    ? `${process.env['NEXT_PUBLIC_APP_URL'] || 'https://app.triajji.com'}/chat?t=${callback.tenant_id}`
    : `${process.env['NEXT_PUBLIC_APP_URL'] || 'https://app.triajji.com'}/chat`;

  const message = `أهلاً، أنا نور من ترياچي 👋

حاولنا نتواصل معاك مرتين بس ماكنتيش متاح.

لو لازلت محتاج مساعدة طبية، ابدأ محادثة جديدة:
${chatUrl}

أو اتصل بنا مرة تانية في أي وقت.

ترياچي 🏥`;

  const result = await sendWhatsAppMessage(callback.patient_phone, message);

  if (result.success) {
    await supabase
      .from('callback_queue')
      .update({
        status: 'whatsapp_sent',
        completed_at: new Date().toISOString(),
        notes: `WhatsApp sent: ${result.messageId ?? 'ok'}`,
      })
      .eq('id', callback.id);

    console.log(`[Callback] WhatsApp fallback sent for ${callback.id}`);
  } else {
    await supabase
      .from('callback_queue')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: `WhatsApp failed: ${result.error ?? 'unknown'}`,
      })
      .eq('id', callback.id);

    console.log(`[Callback] WhatsApp fallback FAILED for ${callback.id}: ${result.error}`);
  }
}

/**
 * Human Agent Handoff
 * Handles transferring a phone call from the AI triage system to a
 * human agent. Sends WhatsApp summaries to both patient and agent,
 * then initiates the Twilio call transfer.
 */

import type { HandoffReason } from '@triaji/shared/types';
import { createServerClient } from '@triaji/shared/supabase';
import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { updateSession } from '@/lib/triage/session-manager';
import { getTwilioClient } from './twilio';

// ─── Types ──────────────────────────────────────────────────────────────────

interface HandoffInput {
  callSid: string;
  sessionId: string;
  patientPhone: string;
  tenantId: string | null;
  reason: HandoffReason;
  chiefComplaint: string | null;
  symptoms: string[];
  specialty: string | null;
}

interface TenantAgentConfig {
  human_agent_number: string | null;
}

// ─── Handoff Summary Templates ──────────────────────────────────────────────

/**
 * WhatsApp message sent to the patient when being transferred to a human agent.
 */
function handoffSummaryForPatient(shortRef: string): string {
  return `مرحباً، هنا دكتور تريو.

جاري تحويلك لأحد موظفينا المتخصصين.
رقم المرجع بتاعك: ${shortRef}

لو المكالمة اتقطعت، ممكن تتصل بينا تاني وتقول رقم المرجع ده.

دكتور تريو — الدكتور الصح، في المكان الصح`;
}

/**
 * WhatsApp message sent to the human agent with a summary of the triage.
 */
function handoffSummaryForAgent(data: {
  shortRef: string;
  patientPhone: string;
  reason: HandoffReason;
  chiefComplaint: string | null;
  symptoms: string[];
  specialty: string | null;
}): string {
  const reasonMap: Record<HandoffReason, string> = {
    emergency: 'حالة طوارئ',
    low_confidence: 'ثقة منخفضة في التشخيص',
    stt_failure: 'مشكلة في التعرف على الكلام',
    patient_request: 'طلب المريض',
    dtmf_request: 'طلب عبر لوحة المفاتيح',
  };

  const reasonAr = reasonMap[data.reason];
  const symptomsText = data.symptoms.length > 0
    ? data.symptoms.join('، ')
    : 'لم يتم تحديد أعراض';
  const specialtyText = data.specialty ?? 'لم يتم تحديد تخصص';
  const complaintText = data.chiefComplaint ?? 'لم يتم تسجيل شكوى';

  return `تحويل مكالمة من دكتور تريو

رقم المرجع: ${data.shortRef}
رقم المريض: ${data.patientPhone}
سبب التحويل: ${reasonAr}

الشكوى الرئيسية: ${complaintText}
الأعراض: ${symptomsText}
التخصص المحتمل: ${specialtyText}

يرجى التعامل مع المكالمة.`;
}

// ─── Handoff Logic ──────────────────────────────────────────────────────────

/**
 * Initiate a human agent handoff for an active phone call.
 *
 * Steps:
 * 1. Look up tenant config for human agent phone number
 * 2. Send WhatsApp summary to patient
 * 3. Send WhatsApp summary to agent (if agent number configured)
 * 4. Transfer the Twilio call to the agent number
 * 5. Update the triage session with handoff status
 *
 * If no agent number is configured, the call is ended gracefully
 * with a message directing the patient to call back.
 */
export async function initiateHandoff(input: HandoffInput): Promise<void> {
  const shortRef = generateHandoffRef();

  // 1. Get tenant config for human agent number
  let agentNumber: string | null = null;

  if (input.tenantId) {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('tenant_config')
      .select('human_agent_number')
      .eq('tenant_id', input.tenantId)
      .single();

    if (data) {
      agentNumber = (data as TenantAgentConfig).human_agent_number;
    }
  }

  // 2. Send WhatsApp summary to patient
  const patientMessage = handoffSummaryForPatient(shortRef);
  await sendWhatsAppMessage(input.patientPhone, patientMessage).catch((err) => {
    console.error('[Handoff] Failed to send WhatsApp to patient:', err);
  });

  // 3. Send WhatsApp summary to agent (if number exists)
  if (agentNumber) {
    const agentMessage = handoffSummaryForAgent({
      shortRef,
      patientPhone: input.patientPhone,
      reason: input.reason,
      chiefComplaint: input.chiefComplaint,
      symptoms: input.symptoms,
      specialty: input.specialty,
    });

    await sendWhatsAppMessage(agentNumber, agentMessage).catch((err) => {
      console.error('[Handoff] Failed to send WhatsApp to agent:', err);
    });
  }

  // 4. Transfer call via Twilio API
  if (agentNumber) {
    try {
      const client = getTwilioClient();
      await client.calls(input.callSid).update({
        twiml: `<Response><Dial>${agentNumber}</Dial></Response>`,
      });
      console.log(`[Handoff] Call ${input.callSid} transferred to ${agentNumber}`);
    } catch (err) {
      console.error('[Handoff] Failed to transfer call:', err instanceof Error ? err.message : 'Unknown error');
    }
  } else {
    // No agent number configured — end call with message
    try {
      const client = getTwilioClient();
      const noAgentMessage = 'عذراً، لا يوجد موظف متاح حالياً. سيتم إرسال ملخص على واتساب. شكراً لتواصلك مع دكتور تريو.';
      await client.calls(input.callSid).update({
        twiml: `<Response><Say language="ar-EG">${noAgentMessage}</Say><Hangup/></Response>`,
      });
      console.log(`[Handoff] No agent configured for tenant ${input.tenantId}, ending call`);
    } catch (err) {
      console.error('[Handoff] Failed to end call:', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  // 5. Update triage session with handoff status
  await updateSession(input.sessionId, {
    handoff_triggered: true,
    handoff_reason: input.reason,
    status: 'completed',
    session_end: new Date().toISOString(),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a short reference for handoff tracking.
 * Format: "HO-XXXX" (Handoff reference)
 */
function generateHandoffRef(): string {
  const hex = Math.floor(Math.random() * 0xFFFF)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `HO-${hex}`;
}

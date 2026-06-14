/**
 * Health Assistant — Safety Module
 * Pre-send safety check, escalation response builder, and post-response flagging.
 *
 * - runSafetyCheck: scans patient message for emergency / mental health patterns
 * - buildEscalationResponse: returns bilingual emergency or mental health crisis response
 * - runPostResponseCheck: flags AI responses that may contain diagnosis, new meds, or doctor contradiction
 */

import { createServerClient } from '@triaji/shared/supabase';
import type {
  AssistantContext,
  SafetyCheckResult,
  FlagType,
  FlaggedResponse,
} from '@triaji/shared/types';

// ─── Emergency Patterns ─────────────────────────────────────────────────────

const EMERGENCY_PATTERNS_AR = [
  /ألم\s*صدر\s*شديد/,
  /ضيق\s*تنفس/,
  /تنميل\s*(في|ب)?\s*الذراع/,
  /صداع\s*مفاجئ\s*شديد/,
  /إغماء/,
  /اغماء/,
  /نزيف\s*شديد/,
  /جرعة\s*زيادة/,
  /جرعه\s*زياده/,
  /مش\s*قادر\s*اتنفس/,
  /قلبي\s*بيوجعني\s*أوي/,
  /قلبي\s*بيوجعني\s*اوي/,
  /حاسس?\s*إن\s*هموت/,
  /حاسس?\s*ان\s*هموت/,
];

const EMERGENCY_PATTERNS_EN = [
  /severe\s+chest\s+pain/i,
  /breathing\s+difficulty/i,
  /can'?t\s+breathe/i,
  /numbness\s+(in\s+)?(my\s+)?arm/i,
  /sudden\s+(severe\s+)?headache/i,
  /fainting/i,
  /severe\s+bleeding/i,
  /overdose/i,
  /heart\s+attack/i,
];

const MENTAL_HEALTH_PATTERNS_AR = [
  /عايز\s*أموت/,
  /عايزه?\s*اموت/,
  /مش\s*عايز\s*أكمل/,
  /مش\s*عايزه?\s*اكمل/,
  /تعبت\s*من\s*الحياة/,
  /تعبت\s*من\s*الحياه/,
  /إيذاء\s*نفسي/,
  /ايذاء\s*نفسي/,
  /انتحار/,
  /عايز\s*أأذي\s*نفسي/,
  /عايز\s*ااذي\s*نفسي/,
  /مش\s*عايز\s*أعيش/,
  /مش\s*عايز\s*اعيش/,
];

const MENTAL_HEALTH_PATTERNS_EN = [
  /want\s+to\s+die/i,
  /end\s+my\s+life/i,
  /self[\s-]?harm/i,
  /suicide/i,
  /kill\s+myself/i,
  /don'?t\s+want\s+to\s+live/i,
  /hurt\s+myself/i,
];

// ─── Post-Response Detection Patterns ───────────────────────────────────────

const DIAGNOSIS_PATTERNS = [
  /عندك\s*(مرض|حالة|إصابة)/,
  /التشخيص\s*(هو|إن)/,
  /ده\s*(ممكن\s+يكون|غالبًا)/,
  /you\s+(have|may\s+have|might\s+have|probably\s+have)/i,
  /diagnosis\s+is/i,
  /this\s+(is\s+likely|could\s+be|appears\s+to\s+be)/i,
  /you\s+are\s+(suffering\s+from|diagnosed\s+with)/i,
];

const NEW_MED_PATTERNS = [
  /خد\s*(دواء|حبوب|علاج)/,
  /جرّب\s*(دواء|حبوب|علاج)/,
  /أنصحك\s+ت(اخد|جرب)/,
  /انصحك\s+ت(اخد|جرب)/,
  /take\s+(medication|medicine|drug|pill)/i,
  /try\s+taking/i,
  /recommend\s+(taking|starting|using)/i,
  /you\s+should\s+(take|start|use)\s+(a\s+)?(\w+\s+)?(medication|medicine|drug)/i,
  /suggest\s+(taking|starting)/i,
];

const CONTRADICTS_DOCTOR_PATTERNS = [
  /الدكتور\s*غلط/,
  /مش\s*صح\s*اللي\s*قاله?\s*الدكتور/,
  /بدل\s*ما\s*تعمل\s*اللي\s*الدكتور\s*قال/,
  /instead\s+of\s+what\s+your\s+doctor/i,
  /your\s+doctor\s+(is|was)\s+wrong/i,
  /disagree\s+with\s+your\s+doctor/i,
  /don'?t\s+follow\s+your\s+doctor'?s/i,
  /ignore\s+what\s+your\s+doctor/i,
];

// ─── Pre-Send Safety Check ──────────────────────────────────────────────────

/**
 * Check a patient message for emergency or mental health crisis patterns
 * before sending to Claude. Returns a safety result.
 */
export function runSafetyCheck(
  message: string,
  _context: AssistantContext
): SafetyCheckResult {
  const normalizedMsg = message.trim();

  // Check emergency patterns
  for (const pattern of EMERGENCY_PATTERNS_AR) {
    if (pattern.test(normalizedMsg)) {
      return {
        safe: false,
        requiresEscalation: true,
        reason: 'emergency_symptoms',
      };
    }
  }
  for (const pattern of EMERGENCY_PATTERNS_EN) {
    if (pattern.test(normalizedMsg)) {
      return {
        safe: false,
        requiresEscalation: true,
        reason: 'emergency_symptoms',
      };
    }
  }

  // Check mental health patterns
  for (const pattern of MENTAL_HEALTH_PATTERNS_AR) {
    if (pattern.test(normalizedMsg)) {
      return {
        safe: false,
        requiresEscalation: true,
        reason: 'mental_health_crisis',
      };
    }
  }
  for (const pattern of MENTAL_HEALTH_PATTERNS_EN) {
    if (pattern.test(normalizedMsg)) {
      return {
        safe: false,
        requiresEscalation: true,
        reason: 'mental_health_crisis',
      };
    }
  }

  return { safe: true, requiresEscalation: false };
}

// ─── Escalation Response Builder ────────────────────────────────────────────

/**
 * Build an immediate escalation response for emergency or mental health crisis.
 * Does NOT call Claude — returns a deterministic, pre-written response.
 */
export function buildEscalationResponse(
  reason: NonNullable<SafetyCheckResult['reason']>,
  lang: 'ar' | 'en'
): string {
  const isAr = lang === 'ar';

  if (reason === 'emergency_symptoms' || reason === 'medication_overdose_risk') {
    return isAr
      ? `⚠️ الأعراض دي ممكن تكون حالة طوارئ طبية.

🚑 اتصل بالإسعاف فورًا: 123
🏥 أو روح أقرب طوارئ مستشفى دلوقتي.

متستناش — صحتك أهم حاجة. لو فيه حد معاك، خليه يساعدك.`
      : `⚠️ These symptoms may indicate a medical emergency.

🚑 Call ambulance immediately: 123
🏥 Or go to the nearest hospital ER now.

Don't wait — your health is the priority. If someone is with you, ask them to help.`;
  }

  if (reason === 'mental_health_crisis' || reason === 'self_harm') {
    return isAr
      ? `أنا فاهم إنك بتمر بوقت صعب، وأنا هنا معاك. 💙

📞 خط نجدة الصحة النفسية: 08008880700
📞 خط نجدة الطفل والأسرة: 16000

مش لازم تعدي الوقت ده لوحدك. فيه ناس متخصصة تقدر تساعدك دلوقتي.
لو في خطر فوري، اتصل بالإسعاف: 123`
      : `I understand you're going through a difficult time, and I'm here with you. 💙

📞 Mental health helpline: 08008880700
📞 Child & family helpline: 16000

You don't have to go through this alone. There are professionals who can help you right now.
If there is immediate danger, call ambulance: 123`;
  }

  // Fallback
  return isAr
    ? 'من فضلك تواصل مع الدكتور أو اتصل بالطوارئ لو محتاج مساعدة فورية.'
    : 'Please contact your doctor or call emergency services if you need immediate help.';
}

// ─── Post-Response Check ────────────────────────────────────────────────────

/**
 * Check an AI response for safety flags and store them in the session.
 * Runs asynchronously after the response has been streamed to the patient.
 *
 * Flag types:
 * - possible_diagnosis: AI appears to have made a diagnosis
 * - new_medication_suggested: AI recommended a new medication
 * - contradicts_doctor: AI contradicted the treating doctor
 */
export async function runPostResponseCheck(
  response: string,
  sessionId: string,
  messageIndex: number
): Promise<void> {
  const flags: FlaggedResponse[] = [];
  const now = new Date().toISOString();

  // Check for diagnosis patterns
  for (const pattern of DIAGNOSIS_PATTERNS) {
    if (pattern.test(response)) {
      flags.push({
        messageIndex,
        flagType: 'possible_diagnosis' as FlagType,
        detail: `Matched pattern: ${pattern.source}`,
        flaggedAt: now,
      });
      break; // One flag per type is enough
    }
  }

  // Check for new medication suggestions
  for (const pattern of NEW_MED_PATTERNS) {
    if (pattern.test(response)) {
      flags.push({
        messageIndex,
        flagType: 'new_medication_suggested' as FlagType,
        detail: `Matched pattern: ${pattern.source}`,
        flaggedAt: now,
      });
      break;
    }
  }

  // Check for contradicting doctor
  for (const pattern of CONTRADICTS_DOCTOR_PATTERNS) {
    if (pattern.test(response)) {
      flags.push({
        messageIndex,
        flagType: 'contradicts_doctor' as FlagType,
        detail: `Matched pattern: ${pattern.source}`,
        flaggedAt: now,
      });
      break;
    }
  }

  if (flags.length === 0) return;

  // Store flags in health_assistant_sessions.flagged_responses JSONB
  try {
    const supabase = createServerClient();

    // Read existing flags
    const { data: session } = await supabase
      .from('health_assistant_sessions')
      .select('flagged_responses')
      .eq('id', sessionId)
      .single();

    const existingFlags: FlaggedResponse[] = (session?.flagged_responses as FlaggedResponse[]) ?? [];
    const updatedFlags = [...existingFlags, ...flags];

    await supabase
      .from('health_assistant_sessions')
      .update({ flagged_responses: updatedFlags })
      .eq('id', sessionId);

    console.warn(
      `[HealthAssistant Safety] Flagged ${flags.length} issue(s) in session ${sessionId}:`,
      flags.map((f) => f.flagType).join(', ')
    );
  } catch (err) {
    console.error('[HealthAssistant Safety] Failed to store flags:', err);
  }
}

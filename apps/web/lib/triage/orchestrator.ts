/**
 * Triage Orchestrator
 * Main controller for a triage session. Coordinates all subsystems
 * in strict order per the implementation instructions.
 *
 * Flow:
 * 1. Load session + patient profile
 * 2. Normalize patient message (Arabic dialect -> symptom codes)
 * 3. EMERGENCY CHECK (deterministic, always runs first)
 * 4. Calculate BRS
 * 5. RAG retrieval
 * 6. Build LLM prompt
 * 7. Call Anthropic API
 * 8. Parse AI response
 * 9. Persist messages
 * 10. If complete -> trigger doctor matching
 */

import { normalize } from '@triaji/normalization';
import { evaluate } from '@triaji/rules-engine';
import type { RulesInput } from '@triaji/rules-engine';
import type { PatientProfile, MatchedDoctor, DoctorRecommendation } from '@triaji/shared/types';

import { retrieveByText } from '@/lib/embeddings/retriever';
import { buildSystemPrompt, buildMessages } from './prompt-builder';
import { parseAIResponse, type ParsedResponse } from './response-parser';
import { callClaude } from './claude-client';
import { matchDoctors } from './doctor-matcher';
import {
  getSession,
  getPatientProfile,
  getSessionMessages,
  saveMessages,
  updateSession,
  markSessionEscalated,
} from './session-manager';

export interface OrchestratorResult {
  /** The Arabic text response to show the patient */
  response: string;
  /** Whether this was an emergency escalation */
  isEmergency: boolean;
  /** Whether the triage session is now complete */
  sessionComplete: boolean;
  /** Doctor recommendation (if session complete and specialty determined) */
  recommendation?: DoctorRecommendation;
  /** Emergency details (if emergency) */
  emergency?: {
    escalationType: string;
    reasonAr: string;
    instructionsAr: string;
  };
}

/**
 * Build a RulesInput from patient profile and normalized symptoms.
 */
function buildRulesInput(
  symptoms: string[],
  rawText: string,
  profile: PatientProfile | null
): RulesInput {
  return {
    symptoms,
    rawText,
    profile: {
      age: profile?.age ?? null,
      biologicalSex: profile?.biological_sex ?? null,
      smokingStatus: profile?.smoking_status ?? 'never',
      bloodPressure: profile?.blood_pressure ?? 'unknown',
      diabetesType: profile?.diabetes_type ?? 'none',
      diabetesControl: profile?.diabetes_control ?? 'na',
      heartCondition: profile?.heart_condition ?? 'none',
      previousHeartAttack: profile?.previous_heart_attack ?? false,
      brs: profile?.background_risk_score ?? 0,
      riskLevel: profile?.risk_level ?? 'low',
    },
  };
}

/**
 * Handle a patient message in a triage session.
 * This is the main entry point for the orchestrator.
 */
export async function handlePatientMessage(
  sessionId: string,
  patientMessage: string
): Promise<OrchestratorResult> {
  // 1. Load session state + patient profile
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  if (session.status !== 'active') {
    throw new Error(`Session is not active (status: ${session.status})`);
  }

  const profile = session.patient_id
    ? await getPatientProfile(session.patient_id)
    : null;

  // 2. Normalize patient message (Arabic dialect -> symptom codes)
  const normalized = normalize(patientMessage);

  // 3. EMERGENCY CHECK — runs before anything else, always
  const rulesInput = buildRulesInput(normalized.symptoms, patientMessage, profile);
  const rulesResult = evaluate(rulesInput);

  if (rulesResult.emergency.triggered) {
    // Emergency detected — escalate immediately, NO LLM call
    await markSessionEscalated(sessionId, {
      ruleName: rulesResult.emergency.ruleName,
      escalationType: rulesResult.emergency.escalationType,
    });

    const emergencyResponse = rulesResult.emergency.responseAr!;

    // Save the message pair
    await saveMessages(sessionId, patientMessage, emergencyResponse, [], true);

    // Update session with extracted symptoms
    if (normalized.symptoms.length > 0) {
      const currentSymptoms = session.extracted_symptoms ?? [];
      const allSymptoms = [...new Set([...currentSymptoms, ...normalized.symptoms])];
      await updateSession(sessionId, { extracted_symptoms: allSymptoms });
    }

    return {
      response: emergencyResponse,
      isEmergency: true,
      sessionComplete: true,
      emergency: {
        escalationType: rulesResult.emergency.escalationType!,
        reasonAr: rulesResult.emergency.responseAr!,
        instructionsAr: rulesResult.emergency.responseAr!,
      },
    };
  }

  // 4. BRS is already calculated in rulesResult.brs

  // 5. RAG retrieval — semantic search against kb_embeddings
  const ragDocs = await retrieveByText(patientMessage, {
    threshold: 0.50,
    maxResults: 5,
  });

  // 6. Build LLM prompt
  const systemPrompt = buildSystemPrompt(profile, rulesResult.brs, ragDocs);
  const history = await getSessionMessages(sessionId);
  const messages = buildMessages(history, patientMessage);

  // 7. Call Anthropic API
  const aiResponseText = await callClaude(systemPrompt, messages);

  // 8. Parse AI response
  const parsed: ParsedResponse = parseAIResponse(aiResponseText);

  // 9. Persist messages
  const ragDocIds = ragDocs.map((d) => d.id);
  await saveMessages(sessionId, patientMessage, aiResponseText, ragDocIds, false);

  // Update session with extracted symptoms and RAG docs
  const currentSymptoms = session.extracted_symptoms ?? [];
  const allSymptoms = [...new Set([...currentSymptoms, ...normalized.symptoms])];
  const currentRagDocs = session.rag_documents_used ?? [];
  const allRagDocs = [...new Set([...currentRagDocs, ...ragDocIds])];

  const sessionUpdates: Record<string, unknown> = {
    extracted_symptoms: allSymptoms,
    rag_documents_used: allRagDocs,
  };

  // Set chief complaint on first message
  if (history.length === 0) {
    sessionUpdates.chief_complaint_ar = patientMessage;
  }

  // Build result
  const result: OrchestratorResult = {
    response: parsed.textResponse,
    isEmergency: false,
    sessionComplete: parsed.sessionComplete,
  };

  // 10. If session complete — update session + trigger doctor matching
  if (parsed.sessionComplete && parsed.determination && !parsed.determination.emergency) {
    // Specialty determined
    sessionUpdates.status = 'completed';
    sessionUpdates.urgency_level = parsed.determination.urgency;
    sessionUpdates.specialty_confidence = parsed.determination.confidence;
    sessionUpdates.session_end = new Date().toISOString();

    // Look up specialty ID by English name
    const { createServerClient } = await import('@triaji/shared/supabase');
    const supabase = createServerClient();
    const { data: specialty } = await supabase
      .from('specialties')
      .select('id, name_ar')
      .ilike('name_en', parsed.determination.determined_specialty_en)
      .single();

    if (specialty) {
      sessionUpdates.determined_specialty_id = specialty.id;

      // Doctor matching using session location or profile governorate
      const patientLat = session.patient_lat;
      const patientLng = session.patient_lng;

      const doctors: MatchedDoctor[] = await matchDoctors({
        specialtyId: specialty.id as string,
        patientLat,
        patientLng,
        governorateId: profile?.governorate_id ?? null,
        tenantId: session.tenant_id ?? null,
      });

      // Save first matched doctor as recommended
      if (doctors.length > 0 && doctors[0]) {
        sessionUpdates.recommended_doctor_id = doctors[0].id;
      }

      result.recommendation = {
        doctors,
        specialtyNameAr: (specialty.name_ar as string) ?? parsed.determination.determined_specialty_ar,
        urgencyLevel: parsed.determination.urgency,
        summaryAr: parsed.determination.summary_ar,
      };
    }
  } else if (parsed.sessionComplete && parsed.determination?.emergency) {
    // AI detected emergency (shouldn't normally happen)
    sessionUpdates.status = 'escalated';
    sessionUpdates.emergency_triggered = true;
    sessionUpdates.urgency_level = 'emergency';
    sessionUpdates.session_end = new Date().toISOString();
  }

  await updateSession(sessionId, sessionUpdates as Parameters<typeof updateSession>[1]);

  return result;
}

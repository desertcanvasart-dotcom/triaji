/**
 * Session Manager
 * CRUD operations for triage sessions and messages in Supabase.
 */

import { createServerClient } from '@triaji/shared/supabase';
import type { TriageSession, SessionMessage, PatientProfile } from '@triaji/shared/types';

export interface CreateSessionInput {
  patientId: string | null;
  tenantId?: string;
  channel?: 'app' | 'website_widget' | 'hospital_kiosk' | 'api';
}

/**
 * Create or find a guest patient record for anonymous triage sessions.
 * Uses a deterministic phone number based on timestamp.
 */
async function getOrCreateGuestPatient(): Promise<string> {
  const supabase = createServerClient();
  const guestPhone = `guest-${Date.now()}`;

  const { data, error } = await supabase
    .from('patients')
    .insert({
      phone_number: guestPhone,
      name_ar: 'زائر',
      tenant_id: null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create guest patient: ${error.message}`);
  return data.id as string;
}

/**
 * Create a new triage session.
 * If no patientId is provided, creates a guest patient automatically.
 */
export async function createSession(input: CreateSessionInput): Promise<TriageSession> {
  const supabase = createServerClient();

  // Resolve patient ID — create guest if needed
  const patientId = input.patientId ?? await getOrCreateGuestPatient();

  const { data, error } = await supabase
    .from('triage_sessions')
    .insert({
      patient_id: patientId,
      tenant_id: input.tenantId ?? null,
      status: 'active',
      channel: input.channel ?? 'app',
      emergency_triggered: false,
      extracted_symptoms: [],
      rag_documents_used: [],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data as TriageSession;
}

/**
 * Get a session by ID.
 */
export async function getSession(sessionId: string): Promise<TriageSession | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('triage_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get session: ${error.message}`);
  }
  return data as TriageSession;
}

/**
 * Update a session's fields.
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<
    TriageSession,
    | 'status'
    | 'chief_complaint_ar'
    | 'extracted_symptoms'
    | 'determined_specialty_id'
    | 'specialty_confidence'
    | 'urgency_level'
    | 'emergency_triggered'
    | 'rag_documents_used'
    | 'recommended_doctor_id'
    | 'booking_id'
    | 'session_end'
  >>
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('triage_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) throw new Error(`Failed to update session: ${error.message}`);
}

/**
 * Mark session as escalated (emergency triggered).
 */
export async function markSessionEscalated(
  sessionId: string,
  emergencyResult: { ruleName: string | null; escalationType: string | null }
): Promise<void> {
  await updateSession(sessionId, {
    status: 'escalated',
    emergency_triggered: true,
    urgency_level: 'emergency',
    session_end: new Date().toISOString(),
  });
}

/**
 * Get the patient profile for a patient.
 */
export async function getPatientProfile(patientId: string): Promise<PatientProfile | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('patient_profiles')
    .select('*')
    .eq('patient_id', patientId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get patient profile: ${error.message}`);
  }
  return data as PatientProfile;
}

/**
 * Save a message pair (patient + AI) to session_messages.
 */
export async function saveMessages(
  sessionId: string,
  patientMessage: string,
  aiResponse: string,
  ragDocIds: string[],
  emergencyCheckResult: boolean | null = null
): Promise<void> {
  const supabase = createServerClient();

  const messages = [
    {
      session_id: sessionId,
      role: 'patient',
      content_ar: patientMessage,
      rag_context_ids: [],
      emergency_check_result: emergencyCheckResult,
    },
    {
      session_id: sessionId,
      role: 'ai',
      content_ar: aiResponse,
      rag_context_ids: ragDocIds,
      emergency_check_result: null,
    },
  ];

  const { error } = await supabase.from('session_messages').insert(messages);
  if (error) throw new Error(`Failed to save messages: ${error.message}`);
}

/**
 * Get conversation history for a session (ordered by created_at).
 */
export async function getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('session_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get messages: ${error.message}`);
  return (data ?? []) as SessionMessage[];
}

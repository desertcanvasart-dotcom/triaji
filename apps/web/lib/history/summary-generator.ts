/**
 * Session Summary Generator
 * Creates a session_summaries record when a triage session completes.
 * Called automatically by the orchestrator on session completion.
 */

import { createServerClient } from '@triaji/shared/supabase';

export async function generateSessionSummary(sessionId: string): Promise<void> {
  const supabase = createServerClient();

  // Fetch session with specialty and booking data
  const { data: session } = await supabase
    .from('triage_sessions')
    .select('id, patient_id, tenant_id, chief_complaint_ar, extracted_symptoms, urgency_level, emergency_triggered, determined_specialty_id, recommended_doctor_id, booking_id, status')
    .eq('id', sessionId)
    .single();

  if (!session) return;

  // Determine outcome
  let outcome: string;
  if (session.emergency_triggered) {
    outcome = 'emergency_escalated';
  } else if (session.booking_id) {
    outcome = 'booked';
  } else {
    outcome = 'no_booking';
  }

  // Get specialty name if determined
  let specialtyNameAr: string | null = null;
  if (session.determined_specialty_id) {
    const { data: spec } = await supabase
      .from('specialties')
      .select('name_ar')
      .eq('id', session.determined_specialty_id)
      .single();
    specialtyNameAr = (spec?.name_ar as string) ?? null;
  }

  // Get doctor name and appointment if booked
  let doctorNameAr: string | null = null;
  let appointmentDatetime: string | null = null;
  if (session.recommended_doctor_id) {
    const { data: doctor } = await supabase
      .from('doctors')
      .select('name_ar')
      .eq('id', session.recommended_doctor_id)
      .single();
    doctorNameAr = (doctor?.name_ar as string) ?? null;
  }
  if (session.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('appointment_datetime')
      .eq('id', session.booking_id)
      .single();
    appointmentDatetime = (booking?.appointment_datetime as string) ?? null;
  }

  // Upsert summary (idempotent — won't fail if called twice)
  await supabase
    .from('session_summaries')
    .upsert({
      session_id: session.id,
      patient_id: session.patient_id,
      tenant_id: session.tenant_id ?? null,
      chief_complaint_ar: (session.chief_complaint_ar as string) ?? 'غير محدد',
      symptoms_ar: (session.extracted_symptoms as string[]) ?? [],
      specialty_name_ar: specialtyNameAr,
      urgency_level: (session.urgency_level as string) ?? null,
      doctor_name_ar: doctorNameAr,
      appointment_datetime: appointmentDatetime,
      outcome,
    }, { onConflict: 'session_id' });
}

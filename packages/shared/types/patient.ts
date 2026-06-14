import type {
  BiologicalSex,
  WorkType,
  WorkSchedule,
  ActivityLevel,
  SmokingStatus,
  BPStatus,
  DiabetesType,
  DiabetesControl,
  DiabetesTreatment,
  ConditionStatus,
  RiskLevel,
  SessionStatus,
  UrgencyLevel,
  SessionChannel,
  MessageRole,
  PregnancyStatus,
  MenopauseStatus,
  MenstrualRegularity,
} from './enums';

// ─── Patient ─────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  tenant_id: string;
  phone_number: string;
  name_ar: string;
  created_at: string;
  last_active_at: string;
}

// ─── Patient Profile ─────────────────────────────────────────────────────────

export interface PatientProfile {
  id: string;
  patient_id: string;
  age: number;
  biological_sex: BiologicalSex;
  governorate_id: string;

  // Body measurements
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;

  // Lifestyle
  work_type: WorkType;
  work_schedule: WorkSchedule;
  activity_level: ActivityLevel;

  // Smoking
  smoking_status: SmokingStatus;
  cigarettes_per_day: number | null;
  smoking_years: number | null;

  // Blood Pressure
  blood_pressure: BPStatus;
  bp_on_medication: boolean;

  // Diabetes
  diabetes_type: DiabetesType;
  diabetes_control: DiabetesControl;
  diabetes_treatment: DiabetesTreatment;

  // Cardiac
  heart_condition: ConditionStatus;
  previous_heart_attack: boolean;
  heart_surgery: boolean;

  // Other organs
  kidney_disease: ConditionStatus;
  liver_disease: ConditionStatus;

  // General medical history
  chronic_conditions: string[];
  known_allergies: string[];
  current_medications: string[];
  previous_surgeries: string[];
  surgery_notes: string | null;

  // Computed risk
  background_risk_score: number;
  risk_level: RiskLevel;

  // Insurance
  insurance_provider_code: string | null;

  // Reproductive health (female only)
  pregnancy_status: PregnancyStatus | null;
  previous_pregnancies: number | null;
  menstrual_regularity: MenstrualRegularity | null;
  menopause_status: MenopauseStatus | null;
  last_menstrual_period_approx: string | null;

  updated_at: string;
}

// ─── Triage Session ──────────────────────────────────────────────────────────

export interface TriageSession {
  id: string;
  patient_id: string;
  tenant_id: string;
  session_start: string;
  session_end: string | null;
  status: SessionStatus;

  // Chief complaint & extraction
  chief_complaint_ar: string | null;
  extracted_symptoms: string[];

  // Specialty determination
  determined_specialty_id: string | null;
  specialty_confidence: number | null;
  urgency_level: UrgencyLevel;
  emergency_triggered: boolean;

  // RAG context
  rag_documents_used: string[];

  // Patient geolocation (set via browser Geolocation API)
  patient_lat: number | null;
  patient_lng: number | null;

  // Outcome
  recommended_doctor_id: string | null;
  booking_id: string | null;
  channel: SessionChannel;

  // Phone call fields (Phase 11)
  call_sid: string | null;
  call_duration_seconds: number | null;
  recording_url: string | null;
  transcript_full: string | null;
  handoff_triggered: boolean;
  handoff_reason: string | null;

  // Bilingual phone support (Phase 13)
  detected_lang: 'ar' | 'en';
}

// ─── Session Message ─────────────────────────────────────────────────────────

export interface SessionMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content_ar: string;
  rag_context_ids: string[];
  emergency_check_result: boolean | null;
  image_urls: string[] | null;
  image_analysis_notes: string | null;
  created_at: string;
}

// ─── Session Summary (Patient History) ─────────────────────────────────────
export interface SessionSummary {
  id: string;
  session_id: string;
  patient_id: string;
  tenant_id: string | null;
  chief_complaint_ar: string;
  symptoms_ar: string[];
  specialty_name_ar: string | null;
  urgency_level: string | null;
  doctor_name_ar: string | null;
  appointment_datetime: string | null;
  outcome: 'booked' | 'emergency_escalated' | 'no_booking' | 'cancelled';
  patient_notes_ar: string | null;
  created_at: string;
}

export interface HistoryConsent {
  id: string;
  patient_id: string;
  doctor_id: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

// ─── Health Assistant Types ──────────────────────────────────────────────────

export interface MedicationSummary {
  nameAr: string;
  nameEn?: string;
  dose: string;
  frequencyAr: string;
  frequencyEn?: string;
  forConditionAr: string;
  dispensed: boolean;
}

export interface LabResultSummary {
  testNameAr: string;
  testNameEn?: string;
  value: string;
  unit: string;
  isAbnormal: boolean;
  date: string;
  referenceRange?: string;
}

export interface VitalTrendSummary {
  vitalType: string;
  values: number[];
  dates: string[];
  trend: 'improving' | 'stable' | 'worsening';
}

export interface PrescriptionSummary {
  nameAr: string;
  nameEn?: string;
  dose: string;
  frequencyAr: string;
  prescribingDoctorAr: string;
  dispensed: boolean;
  date: string;
}

export interface EncounterSummary {
  date: string;
  doctorNameAr: string;
  specialty: string;
  chiefComplaintAr: string;
  planAr: string;
}

export interface FollowUpSummary {
  reasonAr: string;
  dueDate: string;
  doctorNameAr: string;
  isOverdue: boolean;
}

export interface ProtocolStatusSummary {
  conditionAr: string;
  compliancePct: number;
  overdueTests: string[];
}

export interface FamilyHistorySummary {
  conditionAr: string;
  relation: string;
}

export interface AssistantContext {
  patientFirstName: string;
  patientAge: number;
  patientSex: 'male' | 'female';
  patientGovernorate: string;
  chronicConditions: string[];
  allergies: string[];
  currentMedications: MedicationSummary[];
  familyHistory: FamilyHistorySummary[];
  brsLevel: 'low' | 'medium' | 'high';
  recentLabResults: LabResultSummary[];
  vitalsTrend: VitalTrendSummary[];
  activePrescriptions: PrescriptionSummary[];
  recentEncounters: EncounterSummary[];
  overdueFollowUps: FollowUpSummary[];
  upcomingFollowUps: FollowUpSummary[];
  protocolStatus: ProtocolStatusSummary[];
  gpDoctorNameAr?: string;
  gpDoctorSpecialty?: string;
  lang: 'ar' | 'en';
}

export interface AssistantSession {
  id: string;
  patient_id: string;
  lang: string;
  messages: AssistantMessage[];
  started_at: string;
  last_message_at: string;
  message_count: number;
  escalation_triggered: boolean;
  context_snapshot_at: string | null;
  flagged_responses: FlaggedResponse[];
  created_at: string;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type FlagType = 'possible_diagnosis' | 'new_medication_suggested' | 'contradicts_doctor';

export interface FlaggedResponse {
  messageIndex: number;
  flagType: FlagType;
  detail: string;
  flaggedAt: string;
}

export interface SafetyCheckResult {
  safe: boolean;
  requiresEscalation: boolean;
  reason?: 'emergency_symptoms' | 'mental_health_crisis' | 'medication_overdose_risk' | 'self_harm';
}

import type { GPRequestStatus, GPRequestInitiator, ReferralStatus, ReferralTier, ConsentScope } from './enums';

// ─── GP Relationships ───────────────────────────────────────────────────────

export interface GPRelationship {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_account_id: string;
  status: GPRequestStatus;
  initiated_by: GPRequestInitiator;
  requested_at: string;
  confirmed_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  end_reason_ar: string | null;
  notify_new_labs: boolean;
  notify_new_prescriptions: boolean;
  notify_overdue_followups: boolean;
  notify_new_specialist: boolean;
  created_at: string;
}

// ─── GP Notes ───────────────────────────────────────────────────────────────

export interface GPNote {
  id: string;
  patient_id: string;
  doctor_account_id: string;
  note_ar: string | null;
  note_en: string | null;
  created_at: string;
}

// ─── Referrals ──────────────────────────────────────────────────────────────

export interface Referral {
  id: string;
  referring_doctor_id: string;
  referring_account_id: string;
  referring_booking_id: string | null;
  patient_id: string;
  tier: ReferralTier;
  referred_specialty_id: string;
  referred_doctor_id: string | null;
  referred_account_id: string | null;
  reason_ar: string;
  reason_en: string | null;
  clinical_summary_ar: string | null;
  clinical_summary_en: string | null;
  urgency: string;
  status: ReferralStatus;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason_ar: string | null;
  appointment_booked_at: string | null;
  consultation_done_at: string | null;
  outcome_booking_id: string | null;
  outcome_summary_ar: string | null;
  outcome_reported_at: string | null;
  referral_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Disease Protocols ──────────────────────────────────────────────────────

export interface ProtocolLabTest {
  testCode: string;
  testNameAr: string;
  frequencyMonths: number;
}

export interface ProtocolVital {
  type: string;
  frequencyWeeks: number;
}

export interface ProtocolTarget {
  metric: string;
  targetAr: string;
  targetEn: string;
  targetMin?: number;
  targetMax?: number;
  unit: string;
}

export interface ProtocolWarning {
  metric: string;
  condition: 'above' | 'below';
  threshold: number;
  messageAr: string;
  messageEn?: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ProtocolDefinition {
  labs: ProtocolLabTest[];
  vitals: ProtocolVital[];
  followUpFrequency: { months: number; reason_ar: string };
  targets: ProtocolTarget[];
  warnings: ProtocolWarning[];
}

export interface DiseaseProtocol {
  id: string;
  condition_code: string;
  version: number;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  is_active: boolean;
  protocol_definition: ProtocolDefinition;
  created_at: string;
}

export interface ProtocolEnrollment {
  id: string;
  patient_id: string;
  protocol_id: string;
  condition_code: string;
  enrolled_at: string;
  enrolled_by: string;
  is_active: boolean;
  paused_at: string | null;
  paused_reason_ar: string | null;
  last_compliance_check: string | null;
  overall_compliance_pct: number | null;
}

// ─── Record Access Grants ───────────────────────────────────────────────────

export interface RecordAccessGrant {
  id: string;
  patient_id: string;
  granted_to_doctor: string;
  granted_to_account: string;
  scope: ConsentScope;
  conditions_filter: string[] | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
  grant_reason_ar: string | null;
  source: string;
  share_token: string | null;
  created_at: string;
}

// ─── Protocol Alert ─────────────────────────────────────────────────────────

export interface ProtocolAlert {
  patientId: string;
  condition: string;
  alertType: 'lab_overdue' | 'followup_overdue' | 'threshold_exceeded';
  messageAr: string;
  messageEn: string;
  severity: 'info' | 'warning' | 'critical';
  actionLink: string;
}

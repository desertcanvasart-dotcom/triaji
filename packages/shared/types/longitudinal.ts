import type { VitalType, VitalSource, FollowUpStatus } from './enums';

// ─── Vitals History ─────────────────────────────────────────────────────────

export interface VitalEntry {
  id: string;
  patient_id: string;
  vital_type: VitalType;
  value: number;
  unit: string;
  measured_at: string;
  source: VitalSource;
  booking_id: string | null;
  health_record_id: string | null;
  entered_by_doctor: string | null;
  notes_ar: string | null;
  created_at: string;
}

// ─── Follow-Up Schedule ─────────────────────────────────────────────────────

export interface FollowUpEntry {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_account_id: string;
  booking_id: string | null;
  health_record_id: string | null;
  follow_up_date: string;
  reason_ar: string | null;
  reason_en: string | null;
  status: FollowUpStatus;
  reminder_1_sent_at: string | null;
  reminder_2_sent_at: string | null;
  overdue_alert_sent: boolean;
  source: string;
  ai_confidence: number | null;
  completed_booking_id: string | null;
  notes_ar: string | null;
  created_at: string;
}

// ─── Medication Adherence ───────────────────────────────────────────────────

export interface AdherenceRecord {
  prescriptionId: string;
  drugNameAr: string;
  drugNameEn: string | null;
  dose: string | null;
  frequencyAr: string | null;
  prescribedDate: string;
  doctorNameAr: string | null;
  status: 'dispensed' | 'sent_to_pharmacy' | 'not_dispensed';
  dispensedAt: string | null;
  pharmacyNameAr: string | null;
}

// ─── Vital Trend Data Point ─────────────────────────────────────────────────

export interface VitalTrendPoint {
  date: string;
  value: number;
  source: VitalSource;
}

// ─── Medical Record Summary ─────────────────────────────────────────────────

export interface MedicalRecordSummary {
  brsScore: number;
  riskLevel: string;
  upcomingAppointments: number;
  activeMedications: number;
  lastLabDaysAgo: number | null;
}

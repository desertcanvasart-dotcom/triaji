/**
 * Health Record Types
 * Shared types for prescription + lab result tracking.
 */

export type RecordType = 'prescription' | 'lab_result' | 'scan' | 'discharge_summary' | 'other';

export interface Medication {
  name_ar: string | null;
  name_en: string | null;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  prescribing_doctor: string | null;
}

export interface LabValue {
  test_name: string;
  value: string;
  unit: string;
  reference_range: string | null;
  is_abnormal: boolean;
}

export interface HealthRecord {
  id: string;
  patient_id: string;
  session_id: string | null;
  record_type: RecordType;
  file_url: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;

  analysed: boolean;
  analysed_at: string | null;

  medications: Medication[];
  prescription_date: string | null;
  prescribing_doctor: string | null;

  lab_values: LabValue[];
  lab_date: string | null;
  lab_name: string | null;

  summary_ar: string | null;
  summary_en: string | null;

  has_abnormal_values: boolean;
  requires_attention: boolean;

  deleted_at: string | null;
}

export interface PrescriptionAnalysis {
  medications: Medication[];
  prescription_date: string | null;
  prescribing_doctor: string | null;
  summary_ar: string;
  summary_en: string;
}

export interface LabResultAnalysis {
  lab_values: LabValue[];
  lab_date: string | null;
  lab_name: string | null;
  has_abnormal_values: boolean;
  summary_ar: string;
  summary_en: string;
  requires_attention: boolean;
}

export type AnalysisResult = PrescriptionAnalysis | LabResultAnalysis;

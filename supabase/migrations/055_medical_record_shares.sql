-- 055_medical_record_shares.sql
-- Time-limited share tokens for the patient "medical passport" (read-only record).
-- Created by POST /api/patient/medical-record/share; resolved by
-- GET /api/patient/medical-record/shared/[token]. Both go through the
-- service-role API (no client access), so the table is RLS-locked with no
-- public policies.

CREATE TABLE IF NOT EXISTS medical_record_shares (
  token       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_record_shares_patient
  ON medical_record_shares (patient_id);

ALTER TABLE medical_record_shares ENABLE ROW LEVEL SECURITY;

-- 057_protocol_alerts.sql
-- Protocol-compliance alerts produced by the daily protocol-check cron
-- (apps/web/app/api/cron/protocol-check) from each patient's enrolled
-- disease_protocols, and read by the doctor + patient dashboards
-- (doctor/patients[, /[id], /[id]/alerts], patient/home). All access goes
-- through the service-role API, so the table is RLS-locked with no public
-- policies (mirrors 055_medical_record_shares).
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS protocol_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES patient_protocol_enrollment(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL,            -- overdue_lab | overdue_followup | overdue_vital | threshold_exceeded
  severity        TEXT NOT NULL,            -- critical | warning | info
  message_ar      TEXT NOT NULL,
  message_en      TEXT,
  threshold_value TEXT,
  actual_value    TEXT,
  unit            TEXT,
  resolved_at     TIMESTAMPTZ,              -- NULL = active/unresolved
  resolved_by     UUID,                     -- doctor_accounts.id that resolved it (no FK; informational)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocol_alerts_patient
  ON protocol_alerts (patient_id);
CREATE INDEX IF NOT EXISTS idx_protocol_alerts_patient_unresolved
  ON protocol_alerts (patient_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_alerts_enrollment
  ON protocol_alerts (enrollment_id);

ALTER TABLE protocol_alerts ENABLE ROW LEVEL SECURITY;

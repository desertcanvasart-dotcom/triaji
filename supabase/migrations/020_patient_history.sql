-- Migration 020: Patient History
-- Session summaries + history consent for doctor access

-- Patient-facing session summary (generated after session completes)
CREATE TABLE session_summaries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID NOT NULL REFERENCES triage_sessions(id) UNIQUE,
  patient_id          UUID NOT NULL REFERENCES patients(id),
  tenant_id           UUID REFERENCES tenants(id),
  chief_complaint_ar  TEXT NOT NULL,
  symptoms_ar         TEXT[] DEFAULT '{}',
  specialty_name_ar   TEXT,
  urgency_level       TEXT,
  doctor_name_ar      TEXT,
  appointment_datetime TIMESTAMPTZ,
  outcome             TEXT,  -- 'booked' | 'emergency_escalated' | 'no_booking' | 'cancelled'
  patient_notes_ar    TEXT,  -- patient can add their own notes post-visit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Doctor consent — patient grants a specific doctor read access to history
CREATE TABLE history_consent (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES patients(id),
  doctor_id   UUID NOT NULL REFERENCES doctors(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,         -- NULL = no expiry
  revoked_at  TIMESTAMPTZ,         -- NULL = still active
  UNIQUE (patient_id, doctor_id)
);

ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_consent   ENABLE ROW LEVEL SECURITY;

-- Patients see only their own summaries
CREATE POLICY patient_own_history ON session_summaries
  FOR SELECT
  USING (patient_id IN (
    SELECT id FROM patients WHERE phone_number = auth.jwt() ->> 'phone'
  ));

CREATE INDEX idx_summaries_patient   ON session_summaries (patient_id);
CREATE INDEX idx_summaries_created   ON session_summaries (created_at DESC);
CREATE INDEX idx_consent_patient     ON history_consent (patient_id);
CREATE INDEX idx_consent_doctor      ON history_consent (doctor_id);

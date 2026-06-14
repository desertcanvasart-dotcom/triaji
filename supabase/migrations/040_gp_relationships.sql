-- ============================================================
-- Migration 040: GP Relationships + GP Notes
-- Primary care doctor linkage
-- ============================================================

CREATE TYPE gp_request_status AS ENUM (
  'pending', 'active', 'declined', 'ended'
);

CREATE TYPE gp_request_initiator AS ENUM (
  'patient', 'doctor'
);

CREATE TABLE gp_relationships (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id         UUID NOT NULL REFERENCES doctors(id),
  doctor_account_id UUID NOT NULL REFERENCES doctor_accounts(id),

  status            gp_request_status NOT NULL DEFAULT 'pending',
  initiated_by      gp_request_initiator NOT NULL,

  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at      TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  ended_by          TEXT,
  end_reason_ar     TEXT,

  notify_new_labs          BOOLEAN NOT NULL DEFAULT true,
  notify_new_prescriptions BOOLEAN NOT NULL DEFAULT true,
  notify_overdue_followups BOOLEAN NOT NULL DEFAULT true,
  notify_new_specialist    BOOLEAN NOT NULL DEFAULT true,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gp_patient ON gp_relationships (patient_id);
CREATE INDEX idx_gp_doctor  ON gp_relationships (doctor_account_id);
CREATE INDEX idx_gp_status  ON gp_relationships (status);

ALTER TABLE gp_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_gp" ON gp_relationships
  FOR ALL USING (auth.role() = 'service_role');

-- GP freestanding notes (not tied to a booking)
CREATE TABLE gp_notes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_account_id UUID NOT NULL REFERENCES doctor_accounts(id),
  note_ar           TEXT,
  note_en           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gp_notes_patient ON gp_notes (patient_id);
CREATE INDEX idx_gp_notes_doctor  ON gp_notes (doctor_account_id);

ALTER TABLE gp_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_gp_notes" ON gp_notes
  FOR ALL USING (auth.role() = 'service_role');

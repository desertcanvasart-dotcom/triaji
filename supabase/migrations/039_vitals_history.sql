-- ============================================================
-- Migration 039: Vitals History + Follow-Up Schedule
-- Longitudinal patient data tracking
-- ============================================================

CREATE TYPE vital_type AS ENUM (
  'weight_kg',
  'height_cm',
  'bmi',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'blood_glucose_fasting',
  'blood_glucose_random',
  'heart_rate',
  'oxygen_saturation',
  'temperature',
  'waist_cm'
);

CREATE TYPE vital_source AS ENUM (
  'clinic_visit',
  'lab_result',
  'patient_self'
);

CREATE TABLE vitals_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vital_type        vital_type NOT NULL,
  value             DECIMAL(8,2) NOT NULL,
  unit              TEXT NOT NULL,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source            vital_source NOT NULL,
  booking_id        UUID REFERENCES bookings(id),
  health_record_id  UUID REFERENCES health_records(id),
  entered_by_doctor UUID REFERENCES doctor_accounts(id),
  notes_ar          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vitals_patient  ON vitals_history (patient_id);
CREATE INDEX idx_vitals_type     ON vitals_history (vital_type);
CREATE INDEX idx_vitals_measured ON vitals_history (patient_id, vital_type, measured_at DESC);

ALTER TABLE vitals_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_vitals" ON vitals_history
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- FOLLOW-UP SCHEDULE
-- ============================================================

CREATE TYPE followup_status AS ENUM (
  'scheduled',
  'reminded',
  'completed',
  'overdue',
  'cancelled'
);

CREATE TABLE follow_up_schedule (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id           UUID NOT NULL REFERENCES doctors(id),
  doctor_account_id   UUID NOT NULL REFERENCES doctor_accounts(id),
  booking_id          UUID REFERENCES bookings(id),
  health_record_id    UUID REFERENCES health_records(id),

  follow_up_date      DATE NOT NULL,
  reason_ar           TEXT,
  reason_en           TEXT,

  status              followup_status NOT NULL DEFAULT 'scheduled',

  reminder_1_sent_at  TIMESTAMPTZ,
  reminder_2_sent_at  TIMESTAMPTZ,
  overdue_alert_sent  BOOLEAN NOT NULL DEFAULT false,

  source              TEXT NOT NULL DEFAULT 'doctor_picker',
  ai_confidence       DECIMAL(3,2),

  completed_booking_id UUID REFERENCES bookings(id),

  notes_ar            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_followup_patient   ON follow_up_schedule (patient_id);
CREATE INDEX idx_followup_doctor    ON follow_up_schedule (doctor_account_id);
CREATE INDEX idx_followup_date      ON follow_up_schedule (follow_up_date);
CREATE INDEX idx_followup_status    ON follow_up_schedule (status);
CREATE INDEX idx_followup_reminders ON follow_up_schedule (follow_up_date, status)
  WHERE status = 'scheduled';

ALTER TABLE follow_up_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_followups" ON follow_up_schedule
  FOR ALL USING (auth.role() = 'service_role');

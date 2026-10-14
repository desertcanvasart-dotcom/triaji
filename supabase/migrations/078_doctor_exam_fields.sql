-- Migration 078: custom exam fields — a doctor's own fields on the exam page
--
-- Each specialty records different things (tooth number, VAS pain score,
-- visual acuity, BP…). A doctor defines their fields once; they appear as an
-- "Exam details" card on every consultation and the values are saved per
-- booking.
--
-- field_type:
--   text      — one line            number — numeric, optional unit
--   long_text — paragraph           select — one of `options`
--   boolean   — yes / no
--
-- A field that already holds values is archived (is_active = false) rather
-- than deleted, so past visits keep their data. Values are stored as text and
-- interpreted by field_type.

CREATE TABLE IF NOT EXISTS doctor_exam_fields (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_account_id  UUID NOT NULL REFERENCES doctor_accounts(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  field_type         TEXT NOT NULL DEFAULT 'text',
  options            TEXT[] NOT NULL DEFAULT '{}',
  unit               TEXT,
  is_required        BOOLEAN NOT NULL DEFAULT false,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_exam_fields_label_len CHECK (char_length(label) BETWEEN 1 AND 80),
  CONSTRAINT doctor_exam_fields_type CHECK (field_type IN ('text', 'long_text', 'number', 'select', 'boolean'))
);

CREATE INDEX IF NOT EXISTS idx_exam_fields_doctor ON doctor_exam_fields (doctor_account_id, sort_order);

CREATE TABLE IF NOT EXISTS exam_field_values (
  booking_id         UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  field_id           UUID NOT NULL REFERENCES doctor_exam_fields(id) ON DELETE CASCADE,
  doctor_account_id  UUID NOT NULL REFERENCES doctor_accounts(id) ON DELETE CASCADE,
  value              TEXT NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booking_id, field_id),
  CONSTRAINT exam_field_values_len CHECK (char_length(value) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_exam_values_doctor ON exam_field_values (doctor_account_id);

ALTER TABLE doctor_exam_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_field_values  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON doctor_exam_fields;
CREATE POLICY service_role_all ON doctor_exam_fields
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS doctor_own_exam_fields ON doctor_exam_fields;
CREATE POLICY doctor_own_exam_fields ON doctor_exam_fields
  FOR ALL USING (doctor_account_id = auth.uid())
  WITH CHECK (doctor_account_id = auth.uid());

DROP POLICY IF EXISTS service_role_all ON exam_field_values;
CREATE POLICY service_role_all ON exam_field_values
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS doctor_own_exam_values ON exam_field_values;
CREATE POLICY doctor_own_exam_values ON exam_field_values
  FOR ALL USING (doctor_account_id = auth.uid())
  WITH CHECK (doctor_account_id = auth.uid());

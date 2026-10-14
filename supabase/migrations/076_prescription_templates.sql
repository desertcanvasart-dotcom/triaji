-- Migration 076: prescription_templates — a doctor's saved prescriptions
--
-- Doctors write the same handful of prescriptions all day (e.g. a routine
-- extraction: antibiotic + analgesic + mouthwash). A template stores the
-- prescription form's content so it can be applied in one click and then
-- edited for the patient. Applying a template never bypasses the drug
-- interaction check — the form re-runs it for every medication it fills in.
--
-- `medications` mirrors the form's medication rows (without their client ids):
--   [{ drugNameAr, drugNameEn, dose, route, frequencyAr, frequencyEn,
--      durationAr, durationEn, instructionsAr, instructionsEn }]
--
-- Owned by the doctor *account* (auth user), so templates follow the doctor
-- across clinics. Server routes use the service role; the own-rows policy lets
-- a doctor's authenticated client read/write only their templates.

CREATE TABLE IF NOT EXISTS prescription_templates (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_account_id  UUID NOT NULL REFERENCES doctor_accounts(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  diagnosis_ar       TEXT,
  diagnosis_en       TEXT,
  medications        JSONB NOT NULL DEFAULT '[]',
  pharmacist_notes   TEXT,
  follow_up_value    INTEGER NOT NULL DEFAULT 0,
  follow_up_unit     TEXT NOT NULL DEFAULT 'day',
  use_count          INTEGER NOT NULL DEFAULT 0,
  last_used_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prescription_templates_name_len CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT prescription_templates_meds_array CHECK (jsonb_typeof(medications) = 'array'),
  CONSTRAINT prescription_templates_follow_up_unit CHECK (follow_up_unit IN ('day', 'week', 'month')),
  CONSTRAINT prescription_templates_follow_up_value CHECK (follow_up_value >= 0)
);

-- Most-used first is how the form lists them.
CREATE INDEX IF NOT EXISTS idx_rx_templates_doctor
  ON prescription_templates (doctor_account_id, use_count DESC);

ALTER TABLE prescription_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON prescription_templates;
CREATE POLICY service_role_all ON prescription_templates
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS doctor_own_templates ON prescription_templates;
CREATE POLICY doctor_own_templates ON prescription_templates
  FOR ALL USING (doctor_account_id = auth.uid())
  WITH CHECK (doctor_account_id = auth.uid());

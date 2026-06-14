-- ============================================================
-- Migration 048: Paediatric Profiles
-- Guardian relationships, growth, vaccination, milestones,
-- school health, weight-based dosing
-- ============================================================

-- ── Guardian Relationships ──────────────────────────────────

CREATE TYPE guardian_relation AS ENUM (
  'mother', 'father', 'grandmother', 'grandfather',
  'sibling', 'legal_guardian', 'other'
);

CREATE TABLE guardian_relationships (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guardian_patient_id  UUID NOT NULL REFERENCES patients(id),
  child_patient_id     UUID NOT NULL REFERENCES patients(id),
  relation             guardian_relation NOT NULL DEFAULT 'mother',
  is_primary_guardian  BOOLEAN NOT NULL DEFAULT true,
  can_book             BOOLEAN NOT NULL DEFAULT true,
  can_view_records     BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guardian_patient_id, child_patient_id)
);

CREATE INDEX idx_guardian_parent ON guardian_relationships (guardian_patient_id);
CREATE INDEX idx_guardian_child  ON guardian_relationships (child_patient_id);

ALTER TABLE guardian_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_guardian" ON guardian_relationships FOR ALL USING (auth.role() = 'service_role');

-- ── Paediatric Profile Extensions ───────────────────────────

ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS is_paediatric         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_of_birth         DATE,
  ADD COLUMN IF NOT EXISTS gestational_age_weeks INTEGER,
  ADD COLUMN IF NOT EXISTS birth_weight_grams    INTEGER,
  ADD COLUMN IF NOT EXISTS blood_type            TEXT,
  ADD COLUMN IF NOT EXISTS school_name_ar        TEXT,
  ADD COLUMN IF NOT EXISTS school_grade_ar       TEXT,
  ADD COLUMN IF NOT EXISTS paediatrician_name_ar TEXT,
  ADD COLUMN IF NOT EXISTS special_needs_ar      TEXT,
  ADD COLUMN IF NOT EXISTS turning_18_notified   BOOLEAN NOT NULL DEFAULT false;

-- ── Growth Measurements ─────────────────────────────────────

CREATE TABLE growth_measurements (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  measured_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  age_months           INTEGER NOT NULL,
  weight_kg            DECIMAL(5,2),
  height_cm            DECIMAL(5,1),
  head_circ_cm         DECIMAL(5,1),
  bmi                  DECIMAL(4,1) GENERATED ALWAYS AS (
    CASE WHEN height_cm > 0 AND weight_kg > 0
    THEN ROUND((weight_kg / ((height_cm/100)^2))::DECIMAL, 1)
    ELSE NULL END
  ) STORED,
  weight_percentile    DECIMAL(5,2),
  height_percentile    DECIMAL(5,2),
  bmi_percentile       DECIMAL(5,2),
  head_circ_percentile DECIMAL(5,2),
  source               TEXT NOT NULL DEFAULT 'clinic_visit',
  measured_by_doctor   UUID REFERENCES doctor_accounts(id),
  notes_ar             TEXT,
  booking_id           UUID REFERENCES bookings(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, measured_at)
);

CREATE INDEX idx_growth_patient ON growth_measurements (patient_id);
CREATE INDEX idx_growth_date    ON growth_measurements (patient_id, measured_at);

ALTER TABLE growth_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_growth" ON growth_measurements FOR ALL USING (auth.role() = 'service_role');

-- ── WHO Growth Reference ────────────────────────────────────

CREATE TABLE who_growth_reference (
  sex        TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  measure    TEXT NOT NULL,
  p3         DECIMAL(6,2),
  p15        DECIMAL(6,2),
  p50        DECIMAL(6,2),
  p85        DECIMAL(6,2),
  p97        DECIMAL(6,2),
  PRIMARY KEY (sex, age_months, measure)
);

-- Seed WHO data — weight (kg) for males
INSERT INTO who_growth_reference (sex, age_months, measure, p3, p15, p50, p85, p97) VALUES
('male', 0, 'weight', 2.5, 2.9, 3.3, 3.9, 4.4),
('male', 1, 'weight', 3.4, 3.9, 4.5, 5.1, 5.8),
('male', 2, 'weight', 4.3, 4.9, 5.6, 6.3, 7.1),
('male', 3, 'weight', 5.0, 5.7, 6.4, 7.2, 8.0),
('male', 4, 'weight', 5.6, 6.2, 7.0, 7.8, 8.7),
('male', 6, 'weight', 6.4, 7.1, 7.9, 8.8, 9.8),
('male', 9, 'weight', 7.1, 7.9, 8.9, 9.9, 11.0),
('male', 12, 'weight', 7.7, 8.6, 9.6, 10.8, 12.0),
('male', 15, 'weight', 8.2, 9.1, 10.3, 11.5, 12.8),
('male', 18, 'weight', 8.6, 9.6, 10.9, 12.2, 13.7),
('male', 24, 'weight', 9.7, 10.8, 12.2, 13.6, 15.3),
('male', 36, 'weight', 11.3, 12.5, 14.3, 16.2, 18.3),
('male', 48, 'weight', 12.7, 14.1, 16.3, 18.8, 21.5),
('male', 60, 'weight', 14.1, 15.8, 18.3, 21.2, 24.6),
('male', 72, 'weight', 15.9, 17.8, 20.5, 24.0, 28.2),
('male', 84, 'weight', 17.7, 19.8, 22.9, 27.1, 32.2),
('male', 96, 'weight', 19.5, 22.0, 25.6, 30.5, 36.8),
('male', 108, 'weight', 21.6, 24.5, 28.6, 34.4, 42.0),
('male', 120, 'weight', 24.0, 27.2, 32.0, 38.8, 47.8),
('male', 132, 'weight', 26.8, 30.5, 36.0, 44.0, 54.5),
('male', 144, 'weight', 30.0, 34.3, 40.8, 50.0, 62.0),
('male', 156, 'weight', 34.0, 39.0, 46.5, 57.0, 70.0),
('male', 168, 'weight', 38.5, 44.0, 52.5, 63.5, 77.0),
('male', 180, 'weight', 43.5, 49.5, 58.5, 69.5, 83.0),
('male', 192, 'weight', 48.0, 54.5, 63.5, 74.5, 87.5),
('male', 204, 'weight', 51.5, 58.5, 67.5, 78.5, 91.0),
('male', 216, 'weight', 53.5, 60.5, 69.5, 80.5, 93.0),
-- weight (kg) for females
('female', 0, 'weight', 2.4, 2.8, 3.2, 3.7, 4.2),
('female', 1, 'weight', 3.2, 3.6, 4.2, 4.8, 5.5),
('female', 2, 'weight', 3.9, 4.5, 5.1, 5.8, 6.6),
('female', 3, 'weight', 4.5, 5.2, 5.8, 6.6, 7.5),
('female', 4, 'weight', 5.0, 5.7, 6.4, 7.3, 8.2),
('female', 6, 'weight', 5.7, 6.5, 7.3, 8.2, 9.3),
('female', 9, 'weight', 6.5, 7.3, 8.2, 9.3, 10.4),
('female', 12, 'weight', 7.0, 7.9, 8.9, 10.1, 11.5),
('female', 15, 'weight', 7.6, 8.5, 9.6, 10.9, 12.4),
('female', 18, 'weight', 8.1, 9.1, 10.2, 11.6, 13.2),
('female', 24, 'weight', 9.0, 10.2, 11.5, 13.0, 14.8),
('female', 36, 'weight', 10.8, 12.0, 13.9, 15.9, 18.1),
('female', 48, 'weight', 12.3, 13.7, 16.1, 18.5, 21.5),
('female', 60, 'weight', 13.7, 15.3, 18.2, 21.2, 25.0),
('female', 72, 'weight', 15.3, 17.2, 20.2, 24.0, 28.5),
('female', 84, 'weight', 17.0, 19.3, 22.4, 27.0, 32.5),
('female', 96, 'weight', 18.8, 21.5, 25.0, 30.5, 37.5),
('female', 108, 'weight', 21.0, 24.0, 28.2, 34.5, 43.0),
('female', 120, 'weight', 23.5, 27.0, 32.0, 39.5, 49.5),
('female', 132, 'weight', 26.5, 30.5, 36.5, 45.0, 56.5),
('female', 144, 'weight', 30.0, 34.5, 41.5, 51.0, 63.5),
('female', 156, 'weight', 34.0, 39.0, 47.0, 56.5, 69.0),
('female', 168, 'weight', 38.0, 43.5, 51.5, 61.0, 73.0),
('female', 180, 'weight', 41.0, 46.5, 54.5, 63.5, 75.0),
('female', 192, 'weight', 43.0, 48.5, 56.0, 65.0, 76.5),
('female', 204, 'weight', 44.0, 49.5, 57.0, 66.0, 77.5),
('female', 216, 'weight', 44.5, 50.0, 57.5, 66.5, 78.0),
-- height (cm) for males
('male', 0, 'height', 46.1, 47.9, 49.9, 51.8, 53.7),
('male', 1, 'height', 50.8, 52.8, 54.7, 56.7, 58.6),
('male', 2, 'height', 54.4, 56.4, 58.4, 60.4, 62.4),
('male', 3, 'height', 57.3, 59.4, 61.4, 63.5, 65.5),
('male', 4, 'height', 59.7, 61.8, 63.9, 66.0, 68.0),
('male', 6, 'height', 63.3, 65.5, 67.6, 69.8, 71.9),
('male', 9, 'height', 67.5, 69.7, 72.0, 74.2, 76.5),
('male', 12, 'height', 71.0, 73.4, 75.7, 78.1, 80.5),
('male', 15, 'height', 73.6, 76.1, 78.7, 81.2, 83.7),
('male', 18, 'height', 76.1, 78.6, 81.2, 83.8, 86.5),
('male', 24, 'height', 81.0, 83.6, 86.4, 89.1, 91.9),
('male', 36, 'height', 88.7, 91.9, 95.1, 98.3, 101.6),
('male', 48, 'height', 94.9, 98.4, 102.3, 106.0, 109.5),
('male', 60, 'height', 100.7, 104.4, 108.6, 112.8, 116.9),
('male', 72, 'height', 106.1, 110.0, 114.2, 118.7, 123.0),
('male', 84, 'height', 111.2, 115.0, 119.5, 124.3, 129.0),
('male', 96, 'height', 116.0, 120.0, 124.8, 129.6, 134.5),
('male', 108, 'height', 120.5, 124.8, 129.8, 135.0, 140.0),
('male', 120, 'height', 125.0, 129.5, 134.8, 140.3, 146.0),
('male', 132, 'height', 129.2, 134.0, 139.8, 146.0, 152.0),
('male', 144, 'height', 133.5, 138.8, 145.5, 152.0, 158.5),
('male', 156, 'height', 139.0, 145.0, 152.0, 159.0, 166.0),
('male', 168, 'height', 146.0, 152.0, 159.0, 166.0, 172.5),
('male', 180, 'height', 152.0, 158.0, 165.0, 172.0, 178.0),
('male', 192, 'height', 156.5, 162.5, 169.0, 175.5, 181.5),
('male', 204, 'height', 159.0, 165.0, 171.5, 177.5, 183.5),
('male', 216, 'height', 160.0, 166.0, 172.5, 178.5, 184.5),
-- height (cm) for females
('female', 0, 'height', 45.4, 47.3, 49.1, 51.0, 52.9),
('female', 1, 'height', 49.8, 51.7, 53.7, 55.6, 57.6),
('female', 2, 'height', 53.0, 55.0, 57.1, 59.1, 61.1),
('female', 3, 'height', 55.6, 57.7, 59.8, 61.9, 64.0),
('female', 4, 'height', 57.8, 60.0, 62.1, 64.3, 66.4),
('female', 6, 'height', 61.2, 63.5, 65.7, 68.0, 70.3),
('female', 9, 'height', 65.3, 67.7, 70.1, 72.6, 75.0),
('female', 12, 'height', 68.9, 71.4, 74.0, 76.6, 79.2),
('female', 15, 'height', 72.0, 74.5, 77.0, 79.6, 82.3),
('female', 18, 'height', 74.0, 76.6, 79.3, 82.0, 84.7),
('female', 24, 'height', 79.3, 82.0, 85.0, 87.8, 90.8),
('female', 36, 'height', 87.4, 90.5, 93.9, 97.2, 100.5),
('female', 48, 'height', 94.1, 97.6, 101.5, 105.5, 109.4),
('female', 60, 'height', 99.9, 103.7, 107.9, 112.2, 116.4),
('female', 72, 'height', 105.5, 109.5, 113.8, 118.2, 122.7),
('female', 84, 'height', 110.5, 114.8, 119.5, 124.3, 129.0),
('female', 96, 'height', 115.4, 120.0, 124.8, 130.0, 135.0),
('female', 108, 'height', 120.0, 124.8, 130.0, 135.5, 141.0),
('female', 120, 'height', 124.5, 129.5, 135.5, 141.5, 147.5),
('female', 132, 'height', 129.5, 135.0, 141.5, 148.0, 154.5),
('female', 144, 'height', 135.0, 141.0, 148.0, 154.5, 161.0),
('female', 156, 'height', 140.0, 146.5, 153.0, 159.5, 165.5),
('female', 168, 'height', 144.0, 150.0, 156.5, 163.0, 169.0),
('female', 180, 'height', 146.0, 152.0, 158.0, 164.5, 170.5),
('female', 192, 'height', 147.0, 153.0, 159.0, 165.0, 171.0),
('female', 204, 'height', 147.5, 153.0, 159.5, 165.5, 171.5),
('female', 216, 'height', 147.5, 153.5, 159.5, 165.5, 171.5);

-- ── Percentile Calculation (linear interpolation) ───────────

CREATE OR REPLACE FUNCTION calculate_percentile(
  p_sex        TEXT,
  p_age_months INTEGER,
  p_measure    TEXT,
  p_value      DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  ref RECORD;
  lower_ref RECORD;
  upper_ref RECORD;
  interp_p3 DECIMAL; interp_p15 DECIMAL; interp_p50 DECIMAL;
  interp_p85 DECIMAL; interp_p97 DECIMAL;
  frac DECIMAL;
BEGIN
  -- Try exact age match
  SELECT * INTO ref FROM who_growth_reference
  WHERE sex = p_sex AND age_months = p_age_months AND measure = p_measure;

  IF NOT FOUND THEN
    -- Linear interpolation between flanking ages
    SELECT * INTO lower_ref FROM who_growth_reference
    WHERE sex = p_sex AND age_months < p_age_months AND measure = p_measure
    ORDER BY age_months DESC LIMIT 1;

    SELECT * INTO upper_ref FROM who_growth_reference
    WHERE sex = p_sex AND age_months > p_age_months AND measure = p_measure
    ORDER BY age_months ASC LIMIT 1;

    IF lower_ref IS NULL OR upper_ref IS NULL THEN RETURN NULL; END IF;

    frac := (p_age_months - lower_ref.age_months)::DECIMAL /
            NULLIF((upper_ref.age_months - lower_ref.age_months), 0);
    IF frac IS NULL THEN RETURN NULL; END IF;

    interp_p3  := lower_ref.p3  + frac * (upper_ref.p3  - lower_ref.p3);
    interp_p15 := lower_ref.p15 + frac * (upper_ref.p15 - lower_ref.p15);
    interp_p50 := lower_ref.p50 + frac * (upper_ref.p50 - lower_ref.p50);
    interp_p85 := lower_ref.p85 + frac * (upper_ref.p85 - lower_ref.p85);
    interp_p97 := lower_ref.p97 + frac * (upper_ref.p97 - lower_ref.p97);
  ELSE
    interp_p3  := ref.p3;  interp_p15 := ref.p15; interp_p50 := ref.p50;
    interp_p85 := ref.p85; interp_p97 := ref.p97;
  END IF;

  -- Map value to approximate percentile via linear interpolation between stored points
  IF p_value <= interp_p3  THEN RETURN GREATEST(1, ROUND(3 * p_value / NULLIF(interp_p3, 0), 1));
  ELSIF p_value <= interp_p15 THEN RETURN ROUND(3 + 12 * (p_value - interp_p3) / NULLIF((interp_p15 - interp_p3), 0), 1);
  ELSIF p_value <= interp_p50 THEN RETURN ROUND(15 + 35 * (p_value - interp_p15) / NULLIF((interp_p50 - interp_p15), 0), 1);
  ELSIF p_value <= interp_p85 THEN RETURN ROUND(50 + 35 * (p_value - interp_p50) / NULLIF((interp_p85 - interp_p50), 0), 1);
  ELSIF p_value <= interp_p97 THEN RETURN ROUND(85 + 12 * (p_value - interp_p85) / NULLIF((interp_p97 - interp_p85), 0), 1);
  ELSE RETURN LEAST(99, ROUND(97 + 2 * (p_value - interp_p97) / NULLIF(interp_p97, 0), 1));
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── Vaccine Catalog ─────────────────────────────────────────

CREATE TABLE vaccine_catalog (
  code            TEXT PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  disease_ar      TEXT NOT NULL,
  disease_en      TEXT NOT NULL,
  doses_required  INTEGER NOT NULL DEFAULT 1,
  schedule_months INTEGER[] NOT NULL,
  is_mandatory    BOOLEAN NOT NULL DEFAULT true,
  egypt_moh_code  TEXT,
  notes_ar        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

INSERT INTO vaccine_catalog
  (code, name_ar, name_en, disease_ar, disease_en, doses_required, schedule_months, is_mandatory, sort_order)
VALUES
  ('BCG', 'BCG', 'BCG (Tuberculosis)', 'السل', 'Tuberculosis', 1, ARRAY[0], true, 1),
  ('HBV', 'التهاب الكبد ب', 'Hepatitis B', 'التهاب الكبد الفيروسي ب', 'Hepatitis B', 3, ARRAY[0, 2, 6], true, 2),
  ('OPV', 'شلل الأطفال الفموي', 'Oral Polio Vaccine (OPV)', 'شلل الأطفال', 'Poliomyelitis', 5, ARRAY[2, 4, 6, 18, 48], true, 3),
  ('IPV', 'شلل الأطفال المحقون', 'Inactivated Polio Vaccine (IPV)', 'شلل الأطفال', 'Poliomyelitis', 2, ARRAY[2, 4], true, 4),
  ('PENTA', 'الخماسي', 'Pentavalent (DTP-HBV-Hib)', 'الكزاز + الخناق + الشاهوق + التهاب الكبد ب + هيب', 'Diphtheria + Tetanus + Pertussis + HepB + Hib', 3, ARRAY[2, 4, 6], true, 5),
  ('PCV', 'المكورات الرئوية', 'Pneumococcal Conjugate (PCV13)', 'التهاب رئوي + التهاب سحايا', 'Pneumonia + Meningitis', 3, ARRAY[2, 4, 12], true, 6),
  ('RV', 'الروتا فيروس', 'Rotavirus', 'إسهال الروتا فيروس', 'Rotavirus Diarrhea', 2, ARRAY[2, 4], true, 7),
  ('MMR', 'الحصبة والنكاف والحصبة الألمانية', 'MMR (Measles-Mumps-Rubella)', 'الحصبة + النكاف + الحصبة الألمانية', 'Measles + Mumps + Rubella', 2, ARRAY[12, 18], true, 8),
  ('VARICELLA', 'الجديري المائي', 'Varicella (Chickenpox)', 'الجديري المائي', 'Chickenpox', 1, ARRAY[12], true, 9),
  ('MEN_A', 'المكورات السحائية أ', 'Meningococcal A', 'التهاب السحايا', 'Meningococcal Meningitis', 1, ARRAY[9], true, 10),
  ('DTP_BOOST', 'الثلاثي المعزز', 'DTP Booster', 'الكزاز + الخناق + الشاهوق', 'Tetanus + Diphtheria + Pertussis', 2, ARRAY[18, 48], true, 11),
  ('HBV_SCHOOL', 'التهاب الكبد ب المدرسي', 'Hepatitis B (School)', 'التهاب الكبد الفيروسي ب', 'Hepatitis B', 1, ARRAY[72], true, 12),
  ('TT', 'الكزاز المدرسي', 'Tetanus Toxoid (School)', 'الكزاز', 'Tetanus', 2, ARRAY[72, 132], true, 13),
  ('HPV', 'فيروس الورم الحليمي البشري (HPV)', 'Human Papillomavirus (HPV)', 'سرطان عنق الرحم', 'Cervical Cancer', 2, ARRAY[132, 138], false, 14);

-- ── Vaccination Schedule ────────────────────────────────────

CREATE TYPE vaccine_status AS ENUM (
  'due', 'overdue', 'given', 'skipped', 'deferred'
);

CREATE TABLE vaccination_schedule (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_code         TEXT NOT NULL REFERENCES vaccine_catalog(code),
  dose_number          INTEGER NOT NULL DEFAULT 1,
  scheduled_age_months INTEGER NOT NULL,
  due_date             DATE,
  status               vaccine_status NOT NULL DEFAULT 'due',
  given_date           DATE,
  given_by_doctor      UUID REFERENCES doctor_accounts(id),
  given_at_facility    TEXT,
  batch_number         TEXT,
  next_dose_due        DATE,
  skip_reason_ar       TEXT,
  defer_reason_ar      TEXT,
  notes_ar             TEXT,
  reminder_sent        BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vax_patient ON vaccination_schedule (patient_id);
CREATE INDEX idx_vax_status  ON vaccination_schedule (status);
CREATE INDEX idx_vax_due     ON vaccination_schedule (due_date) WHERE status IN ('due', 'overdue');

ALTER TABLE vaccination_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_vax" ON vaccination_schedule FOR ALL USING (auth.role() = 'service_role');

-- ── Milestone Catalog ───────────────────────────────────────

CREATE TABLE milestone_catalog (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category     TEXT NOT NULL,
  category_ar  TEXT NOT NULL,
  age_months   INTEGER NOT NULL,
  milestone_ar TEXT NOT NULL,
  milestone_en TEXT NOT NULL,
  is_red_flag  BOOLEAN NOT NULL DEFAULT false,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

INSERT INTO milestone_catalog
  (category, category_ar, age_months, milestone_ar, milestone_en, is_red_flag, sort_order)
VALUES
  ('gross_motor', 'حركة كبيرة', 2, 'يرفع رأسه وصدره أثناء الاستلقاء على البطن', 'Lifts head and chest during tummy time', false, 10),
  ('gross_motor', 'حركة كبيرة', 6, 'يجلس بمساعدة', 'Sits with support', false, 20),
  ('gross_motor', 'حركة كبيرة', 9, 'يجلس بدون مساعدة', 'Sits independently', true, 30),
  ('gross_motor', 'حركة كبيرة', 12, 'يقف بمساعدة — قد يمشي خطوات', 'Stands with support — may take first steps', false, 40),
  ('gross_motor', 'حركة كبيرة', 18, 'يمشي باستقلالية', 'Walks independently', true, 50),
  ('gross_motor', 'حركة كبيرة', 24, 'يصعد السلم بمساعدة', 'Climbs stairs with help', false, 60),
  ('gross_motor', 'حركة كبيرة', 36, 'يركب دراجة ثلاثية العجلات', 'Rides tricycle', false, 70),
  ('fine_motor', 'حركة دقيقة', 3, 'يمسك الأشياء لفترة قصيرة', 'Briefly holds objects', false, 110),
  ('fine_motor', 'حركة دقيقة', 6, 'ينقل الأشياء من يد لأخرى', 'Transfers objects hand to hand', false, 120),
  ('fine_motor', 'حركة دقيقة', 9, 'يمسك الأشياء الصغيرة بين الإبهام والسبابة', 'Pincer grasp emerging', true, 130),
  ('fine_motor', 'حركة دقيقة', 18, 'يبني برج من مكعبين أو ثلاثة', 'Builds tower of 2-3 blocks', false, 140),
  ('fine_motor', 'حركة دقيقة', 24, 'يرسم خطاً أو دائرة بسيطة', 'Scribbles and draws simple circle', false, 150),
  ('language', 'لغة', 2, 'يُصدر أصوات مناغاة', 'Cooing sounds', false, 210),
  ('language', 'لغة', 6, 'يُبدب — "بابابا، مامامامـ"', 'Babbling — "bababa, mamama"', false, 220),
  ('language', 'لغة', 9, 'يفهم كلمة "لأ"', 'Understands "no"', true, 230),
  ('language', 'لغة', 12, 'يقول كلمة واحدة على الأقل بمعنى', 'Says at least 1 meaningful word', true, 240),
  ('language', 'لغة', 18, 'يقول 5–10 كلمات', 'Says 5–10 words', true, 250),
  ('language', 'لغة', 24, 'يقول جمل من كلمتين', 'Two-word phrases', true, 260),
  ('language', 'لغة', 36, 'يحكي قصة بسيطة', 'Tells simple stories', false, 270),
  ('social', 'اجتماعي', 2, 'يبتسم استجابةً للتحدث معه', 'Social smile in response to talking', true, 310),
  ('social', 'اجتماعي', 6, 'يتعرف على الوجوه المألوفة', 'Recognises familiar faces', false, 320),
  ('social', 'اجتماعي', 9, 'يُظهر قلق الغرباء', 'Shows stranger anxiety', false, 330),
  ('social', 'اجتماعي', 12, 'يُقلد الأفعال البسيطة', 'Imitates simple actions', false, 340),
  ('social', 'اجتماعي', 24, 'يلعب بجانب الأطفال الآخرين (لعب موازي)', 'Plays alongside other children (parallel play)', false, 350),
  ('social', 'اجتماعي', 36, 'يلعب مع الأطفال الآخرين (لعب تعاوني)', 'Plays with other children (cooperative play)', false, 360);

-- ── Patient Milestones ──────────────────────────────────────

CREATE TABLE patient_milestones (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  milestone_id     UUID NOT NULL REFERENCES milestone_catalog(id),
  achieved         BOOLEAN,
  achieved_at_months INTEGER,
  notes_ar         TEXT,
  assessed_by      TEXT NOT NULL DEFAULT 'parent',
  assessed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, milestone_id)
);

CREATE INDEX idx_milestones_patient ON patient_milestones (patient_id);

ALTER TABLE patient_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_milestones" ON patient_milestones FOR ALL USING (auth.role() = 'service_role');

-- ── School Health Records ───────────────────────────────────

CREATE TABLE school_health_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  academic_year       TEXT NOT NULL,
  school_name_ar      TEXT NOT NULL,
  school_grade_ar     TEXT NOT NULL,
  exam_date           DATE,
  examining_doctor    TEXT,
  height_cm           DECIMAL(5,1),
  weight_kg           DECIMAL(5,2),
  vision_right        TEXT,
  vision_left         TEXT,
  hearing_normal      BOOLEAN,
  dental_notes_ar     TEXT,
  general_notes_ar    TEXT,
  fit_for_school      BOOLEAN NOT NULL DEFAULT true,
  restriction_ar      TEXT,
  certificate_issued  BOOLEAN NOT NULL DEFAULT false,
  certificate_pdf_url TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_school_health_patient ON school_health_records (patient_id);

ALTER TABLE school_health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_school_health" ON school_health_records FOR ALL USING (auth.role() = 'service_role');

-- ── Paediatric Drug Dosing ──────────────────────────────────

CREATE TABLE paediatric_drug_dosing (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drug_name_en          TEXT NOT NULL,
  drug_name_ar          TEXT NOT NULL,
  indication_ar         TEXT,
  dose_mg_per_kg        DECIMAL(6,2),
  dose_min_mg_per_kg    DECIMAL(6,2),
  dose_max_mg_per_kg    DECIMAL(6,2),
  doses_per_day         INTEGER,
  max_single_dose_mg    DECIMAL(8,2),
  max_daily_dose_mg     DECIMAL(8,2),
  min_age_months        INTEGER DEFAULT 0,
  max_age_months        INTEGER DEFAULT 216,
  min_weight_kg         DECIMAL(5,2),
  max_weight_kg         DECIMAL(5,2),
  egyptian_formulations JSONB DEFAULT '[]',
  notes_ar              TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO paediatric_drug_dosing
  (drug_name_en, drug_name_ar, indication_ar, dose_min_mg_per_kg, dose_max_mg_per_kg, doses_per_day, max_daily_dose_mg, min_age_months, egyptian_formulations)
VALUES
  ('Amoxicillin', 'أموكسيسيلين', 'عدوى بكتيرية', 40, 50, 3, 3000, 0,
   '[{"form":"شراب","concentration":"250mg/5ml","unit":"ml"},{"form":"كبسول","concentration":"500mg","unit":"كبسول"}]'),
  ('Paracetamol', 'باراسيتامول', 'حمى وألم', 10, 15, 4, 75, 0,
   '[{"form":"شراب","concentration":"120mg/5ml","unit":"ml"},{"form":"شراب","concentration":"250mg/5ml","unit":"ml"},{"form":"تحميلة","concentration":"125mg","unit":"تحميلة"},{"form":"تحميلة","concentration":"250mg","unit":"تحميلة"}]'),
  ('Ibuprofen', 'إيبوبروفين', 'حمى وألم والتهاب', 5, 10, 3, 40, 6,
   '[{"form":"شراب","concentration":"100mg/5ml","unit":"ml"}]'),
  ('Azithromycin', 'أزيثرومايسين', 'عدوى الجهاز التنفسي', 10, 10, 1, 500, 6,
   '[{"form":"شراب","concentration":"200mg/5ml","unit":"ml"}]'),
  ('Cetirizine', 'سيتيريزين', 'حساسية', 0.25, 0.25, 1, 10, 6,
   '[{"form":"شراب","concentration":"5mg/5ml","unit":"ml"},{"form":"أقراص","concentration":"10mg","unit":"قرص"}]'),
  ('Salbutamol', 'سالبوتامول', 'ربو وصفير', 0.1, 0.15, 3, 8, 0,
   '[{"form":"بخاخ","concentration":"100mcg/puff","unit":"بخة"},{"form":"شراب","concentration":"2mg/5ml","unit":"ml"}]'),
  ('Metronidazole', 'ميترونيدازول', 'إسهال طفيلي', 30, 50, 3, 2000, 0,
   '[{"form":"شراب","concentration":"125mg/5ml","unit":"ml"}]'),
  ('Zinc', 'زنك', 'إسهال حاد (WHO protocol)', 20, 20, 1, 20, 6,
   '[{"form":"أقراص قابلة للذوبان","concentration":"20mg","unit":"قرص"}]');

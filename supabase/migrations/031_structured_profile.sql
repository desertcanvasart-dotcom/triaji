-- ============================================================
-- Migration 031: Structured Patient Profile
-- Replaces free-text fields with junction tables,
-- adds family history and reproductive health.
-- ============================================================

-- ============================================================
-- STRUCTURED ALLERGIES
-- ============================================================

CREATE TABLE allergy_options (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code      TEXT UNIQUE NOT NULL,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  category  TEXT NOT NULL, -- 'medication' | 'food' | 'environmental' | 'contrast' | 'other'
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO allergy_options (code, name_ar, name_en, category, sort_order) VALUES
  ('penicillin',      'بنسلين',                 'Penicillin',            'medication',    1),
  ('sulfa',           'سلفا (سلفوناميد)',        'Sulfa drugs',           'medication',    2),
  ('aspirin',         'أسبرين / NSAIDs',         'Aspirin / NSAIDs',      'medication',    3),
  ('codeine',         'كوديين / مورفين',          'Codeine / Opioids',     'medication',    4),
  ('contrast_dye',    'صبغة الأشعة',             'Contrast dye',          'contrast',      5),
  ('latex',           'مطاط لاتكس',              'Latex',                 'environmental', 6),
  ('dust_mites',      'عث الغبار',              'Dust mites',            'environmental', 7),
  ('pollen',          'حبوب اللقاح',             'Pollen',                'environmental', 8),
  ('cat_dander',      'وبر القطط',               'Cat dander',            'environmental', 9),
  ('nuts',            'مكسرات',                  'Nuts',                  'food',          10),
  ('shellfish',       'مأكولات بحرية',            'Shellfish',             'food',          11),
  ('dairy',           'ألبان',                   'Dairy',                 'food',          12),
  ('eggs',            'بيض',                    'Eggs',                  'food',          13),
  ('gluten',          'جلوتين (قمح)',             'Gluten (wheat)',        'food',          14),
  ('other',           'حساسية أخرى',             'Other allergy',         'other',         99);

CREATE TABLE patient_allergies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  allergy_code      TEXT NOT NULL REFERENCES allergy_options(code),
  notes_ar          TEXT,
  UNIQUE (patient_profile_id, allergy_code)
);

-- ============================================================
-- STRUCTURED CHRONIC CONDITIONS
-- ============================================================

CREATE TABLE chronic_condition_options (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code      TEXT UNIQUE NOT NULL,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  specialty_hint TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO chronic_condition_options (code, name_ar, name_en, specialty_hint, sort_order) VALUES
  ('asthma',          'ربو / أزمة',              'Asthma',                'pulmonology',   1),
  ('thyroid',         'غدة درقية',               'Thyroid disease',       'endocrinology', 2),
  ('epilepsy',        'صرع',                    'Epilepsy',              'neurology',     3),
  ('cancer',          'سرطان (محدد)',             'Cancer (specify)',      'oncology',      4),
  ('osteoporosis',    'هشاشة العظام',            'Osteoporosis',          'rheumatology',  5),
  ('anaemia',         'فقر دم',                 'Anaemia',               'internal',      6),
  ('rheumatoid',      'روماتيزم مفاصل',          'Rheumatoid arthritis',  'rheumatology',  7),
  ('psoriasis',       'صدفية',                  'Psoriasis',             'dermatology',   8),
  ('gerd',            'حموضة / ارتجاع',          'GERD / Acid reflux',   'gastro',        9),
  ('copd',            'انسداد رئوي مزمن',         'COPD',                 'pulmonology',   10),
  ('sleep_apnea',     'انقطاع التنفس أثناء النوم', 'Sleep apnea',          'pulmonology',   11),
  ('anxiety',         'قلق مزمن',               'Chronic anxiety',       'psychiatry',    12),
  ('depression',      'اكتئاب',                 'Depression',            'psychiatry',    13),
  ('ibs',             'قولون عصبي',              'IBS',                   'gastro',        14),
  ('gout',            'نقرس',                   'Gout',                  'rheumatology',  15),
  ('other',           'مرض مزمن آخر',            'Other chronic disease', NULL,            99);

CREATE TABLE patient_chronic_conditions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  condition_code    TEXT NOT NULL REFERENCES chronic_condition_options(code),
  notes_ar          TEXT,
  diagnosed_year    INTEGER,
  UNIQUE (patient_profile_id, condition_code)
);

-- ============================================================
-- STRUCTURED CURRENT MEDICATIONS
-- ============================================================

CREATE TABLE patient_medications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  drug_name_ar      TEXT NOT NULL,
  drug_name_en      TEXT,
  dose              TEXT,
  frequency_ar      TEXT,
  for_condition_ar  TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STRUCTURED PREVIOUS SURGERIES
-- ============================================================

CREATE TABLE surgery_options (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code      TEXT UNIQUE NOT NULL,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO surgery_options (code, name_ar, name_en, sort_order) VALUES
  ('appendectomy',    'استئصال زائدة',           'Appendectomy',          1),
  ('cholecystectomy', 'استئصال مرارة',           'Cholecystectomy',       2),
  ('cesarean',        'عملية قيصرية',            'C-section',             3),
  ('cardiac',         'عملية قلب مفتوح',          'Open heart surgery',    4),
  ('coronary_stent',  'قسطرة / دعامة',           'Coronary stent',        5),
  ('spinal',          'عملية عمود فقري',          'Spinal surgery',        6),
  ('knee_hip',        'تركيب ركبة / ورك',         'Knee/hip replacement',  7),
  ('tonsillectomy',   'استئصال لوز',             'Tonsillectomy',         8),
  ('thyroid_surgery', 'عملية غدة درقية',          'Thyroid surgery',       9),
  ('hernia',          'عملية فتق',               'Hernia repair',         10),
  ('gastric_bypass',  'عملية تحويل مسار معدة',    'Gastric bypass',        11),
  ('kidney',          'عملية كلى / زرع كلية',     'Kidney surgery/transplant', 12),
  ('eye',             'عملية عيون',              'Eye surgery',           13),
  ('other',           'عملية أخرى',              'Other surgery',         99);

CREATE TABLE patient_surgeries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  surgery_code      TEXT NOT NULL REFERENCES surgery_options(code),
  year_approximate  INTEGER,
  notes_ar          TEXT,
  UNIQUE (patient_profile_id, surgery_code)
);

-- ============================================================
-- FAMILY HISTORY
-- ============================================================

CREATE TABLE family_history_options (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code      TEXT UNIQUE NOT NULL,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  brs_impact INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO family_history_options (code, name_ar, name_en, brs_impact, sort_order) VALUES
  ('heart_disease',   'أمراض القلب',             'Heart disease',         2,   1),
  ('heart_attack',    'نوبة قلبية',              'Heart attack',          2,   2),
  ('stroke',          'جلطة دماغية',             'Stroke',                1,   3),
  ('hypertension',    'ضغط دم مرتفع',            'Hypertension',          1,   4),
  ('diabetes',        'سكر دم',                 'Diabetes',              1,   5),
  ('cancer',          'سرطان',                  'Cancer',                1,   6),
  ('kidney_disease',  'أمراض الكلى',             'Kidney disease',        1,   7),
  ('mental_illness',  'أمراض نفسية',             'Mental illness',        0,   8);

CREATE TABLE patient_family_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  condition_code    TEXT NOT NULL REFERENCES family_history_options(code),
  relation          TEXT NOT NULL,
  notes_ar          TEXT,
  UNIQUE (patient_profile_id, condition_code, relation)
);

-- ============================================================
-- REPRODUCTIVE HEALTH (female patients only)
-- ============================================================

CREATE TYPE pregnancy_status AS ENUM (
  'not_pregnant', 'pregnant', 'breastfeeding', 'trying_to_conceive', 'unknown'
);

CREATE TYPE menopause_status AS ENUM (
  'pre_menopause', 'peri_menopause', 'post_menopause', 'not_applicable'
);

CREATE TYPE menstrual_regularity AS ENUM (
  'regular', 'irregular', 'absent', 'not_applicable'
);

ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS pregnancy_status    pregnancy_status,
  ADD COLUMN IF NOT EXISTS previous_pregnancies INTEGER,
  ADD COLUMN IF NOT EXISTS menstrual_regularity menstrual_regularity,
  ADD COLUMN IF NOT EXISTS menopause_status    menopause_status,
  ADD COLUMN IF NOT EXISTS last_menstrual_period_approx TEXT;

-- ============================================================
-- DEPRECATE old free-text columns
-- ============================================================

COMMENT ON COLUMN patient_profiles.known_allergies IS
  'DEPRECATED: Use patient_allergies table. Kept for backward compatibility.';
COMMENT ON COLUMN patient_profiles.chronic_conditions IS
  'DEPRECATED: Use patient_chronic_conditions table. Kept for backward compatibility.';
COMMENT ON COLUMN patient_profiles.current_medications IS
  'DEPRECATED: Use patient_medications table. Kept for backward compatibility.';
COMMENT ON COLUMN patient_profiles.surgery_notes IS
  'DEPRECATED: Use patient_surgeries table. Kept for backward compatibility.';
COMMENT ON COLUMN patient_profiles.previous_surgeries IS
  'DEPRECATED: Use patient_surgeries table. True if patient_surgeries has any rows.';

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_patient_allergies_profile   ON patient_allergies (patient_profile_id);
CREATE INDEX idx_patient_conditions_profile  ON patient_chronic_conditions (patient_profile_id);
CREATE INDEX idx_patient_medications_profile ON patient_medications (patient_profile_id);
CREATE INDEX idx_patient_surgeries_profile   ON patient_surgeries (patient_profile_id);
CREATE INDEX idx_patient_family_profile      ON patient_family_history (patient_profile_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE allergy_options              ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronic_condition_options     ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_options              ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_history_options       ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_allergies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_chronic_conditions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_surgeries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_family_history       ENABLE ROW LEVEL SECURITY;

-- Public read on option catalogs (anyone can read)
CREATE POLICY "public_read_allergy_options" ON allergy_options
  FOR SELECT USING (true);
CREATE POLICY "public_read_chronic_condition_options" ON chronic_condition_options
  FOR SELECT USING (true);
CREATE POLICY "public_read_surgery_options" ON surgery_options
  FOR SELECT USING (true);
CREATE POLICY "public_read_family_history_options" ON family_history_options
  FOR SELECT USING (true);

-- Service role full access on all tables
CREATE POLICY "service_role_all_allergy_options" ON allergy_options
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_chronic_condition_options" ON chronic_condition_options
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_surgery_options" ON surgery_options
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_family_history_options" ON family_history_options
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_patient_allergies" ON patient_allergies
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_patient_chronic_conditions" ON patient_chronic_conditions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_patient_medications" ON patient_medications
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_patient_surgeries" ON patient_surgeries
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_patient_family_history" ON patient_family_history
  FOR ALL USING (auth.role() = 'service_role');

-- Patients can manage their own data
CREATE POLICY "patient_own_allergies" ON patient_allergies
  FOR ALL USING (
    patient_profile_id IN (
      SELECT id FROM patient_profiles WHERE patient_id IN (
        SELECT id FROM patients WHERE phone_number = auth.jwt() ->> 'phone'
      )
    )
  );

CREATE POLICY "patient_own_chronic_conditions" ON patient_chronic_conditions
  FOR ALL USING (
    patient_profile_id IN (
      SELECT id FROM patient_profiles WHERE patient_id IN (
        SELECT id FROM patients WHERE phone_number = auth.jwt() ->> 'phone'
      )
    )
  );

CREATE POLICY "patient_own_medications" ON patient_medications
  FOR ALL USING (
    patient_profile_id IN (
      SELECT id FROM patient_profiles WHERE patient_id IN (
        SELECT id FROM patients WHERE phone_number = auth.jwt() ->> 'phone'
      )
    )
  );

CREATE POLICY "patient_own_surgeries" ON patient_surgeries
  FOR ALL USING (
    patient_profile_id IN (
      SELECT id FROM patient_profiles WHERE patient_id IN (
        SELECT id FROM patients WHERE phone_number = auth.jwt() ->> 'phone'
      )
    )
  );

CREATE POLICY "patient_own_family_history" ON patient_family_history
  FOR ALL USING (
    patient_profile_id IN (
      SELECT id FROM patient_profiles WHERE patient_id IN (
        SELECT id FROM patients WHERE phone_number = auth.jwt() ->> 'phone'
      )
    )
  );

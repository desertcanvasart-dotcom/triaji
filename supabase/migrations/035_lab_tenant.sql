-- ============================================================
-- Migration 035: Lab & Radiology Tenant Types
-- Service catalog + platform test catalog with seed data
-- ============================================================

-- Add new tenant tiers
ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'lab';
ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'radiology';

-- Lab/radiology config columns on tenant_config
ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS lab_type              TEXT,
  ADD COLUMN IF NOT EXISTS accreditation_number  TEXT,
  ADD COLUMN IF NOT EXISTS medical_director_ar   TEXT,
  ADD COLUMN IF NOT EXISTS turnaround_hours      INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS urgent_turnaround_hours INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS accepts_walk_ins      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS home_collection       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_collection_fee_egp DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS collection_notes_ar   TEXT;

-- ============================================================
-- LAB SERVICE CATALOG (per-tenant, with pricing)
-- ============================================================

CREATE TABLE lab_services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  name_ar           TEXT NOT NULL,
  name_en           TEXT NOT NULL,
  category_ar       TEXT NOT NULL,
  service_type      TEXT NOT NULL, -- 'lab_test' | 'radiology'
  price_egp         DECIMAL(10,2) NOT NULL,
  urgent_price_egp  DECIMAL(10,2),
  fasting_required  BOOLEAN NOT NULL DEFAULT false,
  fasting_hours     INTEGER,
  sample_type_ar    TEXT,
  preparation_ar    TEXT,
  modality          TEXT,
  contrast_available BOOLEAN DEFAULT false,
  duration_minutes  INTEGER,
  requires_appointment BOOLEAN NOT NULL DEFAULT false,
  available_slots_per_day INTEGER,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_lab_services_tenant ON lab_services (tenant_id);
CREATE INDEX idx_lab_services_type   ON lab_services (service_type);

ALTER TABLE lab_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_lab_services" ON lab_services
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "public_read_lab_services" ON lab_services
  FOR SELECT USING (true);

-- ============================================================
-- PLATFORM TEST CATALOG (reference data)
-- ============================================================

CREATE TABLE lab_test_catalog (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  category_ar   TEXT NOT NULL,
  service_type  TEXT NOT NULL DEFAULT 'lab_test',
  modality      TEXT,
  fasting_required BOOLEAN DEFAULT false,
  sample_type_ar TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE lab_test_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_lab_test_catalog" ON lab_test_catalog
  FOR SELECT USING (true);
CREATE POLICY "service_role_all_lab_test_catalog" ON lab_test_catalog
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- SEED: Common Egyptian lab tests
-- ============================================================

INSERT INTO lab_test_catalog (code, name_ar, name_en, category_ar, fasting_required, sample_type_ar, sort_order) VALUES
  ('CBC',       'صورة دم كاملة',            'CBC (Complete Blood Count)',    'تحاليل دم',     false, 'دم وريدي',  1),
  ('ESR',       'سرعة الترسيب',             'ESR',                           'تحاليل دم',     false, 'دم وريدي',  2),
  ('CRP',       'بروتين سي التفاعلي',        'CRP',                           'تحاليل دم',     false, 'دم وريدي',  3),
  ('BLOOD_TYPE','فصيلة الدم',               'Blood Type & Rh',               'تحاليل دم',     false, 'دم وريدي',  4),
  ('COAG',      'عوامل التخثر (PT, PTT)',   'Coagulation Profile',           'تحاليل دم',     false, 'دم وريدي',  5),
  ('FBG',       'سكر صايم',                'Fasting Blood Glucose',          'سكر ودهون',     true,  'دم وريدي',  10),
  ('RBG',       'سكر عشوائي',              'Random Blood Glucose',           'سكر ودهون',     false, 'دم وريدي',  11),
  ('HBA1C',     'سكر تراكمي',              'HbA1c',                         'سكر ودهون',     false, 'دم وريدي',  12),
  ('INSULIN',   'أنسولين صايم',             'Fasting Insulin',               'سكر ودهون',     true,  'دم وريدي',  13),
  ('LIPID',     'دهون الدم',               'Lipid Profile',                  'سكر ودهون',     true,  'دم وريدي',  14),
  ('LFT',       'وظائف الكبد',             'Liver Function Tests',           'وظائف أعضاء',  false, 'دم وريدي',  20),
  ('RFT',       'وظائف الكلى',             'Kidney Function Tests',          'وظائف أعضاء',  false, 'دم وريدي',  21),
  ('TFT',       'وظائف الغدة الدرقية (TSH)','Thyroid Function (TSH)',        'وظائف أعضاء',  false, 'دم وريدي',  22),
  ('T3T4',      'هرمونات الغدة T3/T4',     'T3/T4 Thyroid Hormones',        'وظائف أعضاء',  false, 'دم وريدي',  23),
  ('URIC',      'حمض اليوريك',             'Uric Acid',                      'وظائف أعضاء',  false, 'دم وريدي',  24),
  ('VIT_D',     'فيتامين د',               'Vitamin D (25-OH)',              'فيتامينات',     false, 'دم وريدي',  30),
  ('VIT_B12',   'فيتامين ب12',             'Vitamin B12',                   'فيتامينات',     false, 'دم وريدي',  31),
  ('FERRITIN',  'فيريتين (مخزون الحديد)',   'Ferritin',                      'فيتامينات',     false, 'دم وريدي',  32),
  ('IRON',      'حديد الدم',               'Serum Iron',                    'فيتامينات',     false, 'دم وريدي',  33),
  ('CALCIUM',   'كالسيوم',                 'Serum Calcium',                  'فيتامينات',     false, 'دم وريدي',  34),
  ('MAGNESIUM', 'ماغنيسيوم',               'Magnesium',                     'فيتامينات',     false, 'دم وريدي',  35),
  ('HCV',       'التهاب كبد سي (فيروس C)', 'Hepatitis C Antibody',          'التهابات',      false, 'دم وريدي',  40),
  ('HBV',       'التهاب كبد ب',            'Hepatitis B Surface Antigen',   'التهابات',      false, 'دم وريدي',  41),
  ('HIV',       'فيروس نقص المناعة',        'HIV Antibody',                  'التهابات',      false, 'دم وريدي',  42),
  ('WIDAL',     'تحليل وايدال (تيفويد)',    'Widal Test (Typhoid)',           'التهابات',      false, 'دم وريدي',  43),
  ('TOXO',      'توكسوبلازما',             'Toxoplasma IgG/IgM',            'التهابات',      false, 'دم وريدي',  44),
  ('UA',        'تحليل بول كامل',           'Urinalysis (Complete)',          'تحاليل بول',    false, 'عينة بول', 50),
  ('URINE_CX',  'زرع بول (كالتشر)',         'Urine Culture & Sensitivity',   'تحاليل بول',    false, 'عينة بول', 51),
  ('BETA_HCG',  'هرمون الحمل (بيتا HCG)',  'Beta HCG (Pregnancy)',          'هرمونات',       false, 'دم وريدي',  60),
  ('LH_FSH',    'هرمونات LH / FSH',        'LH & FSH',                      'هرمونات',       false, 'دم وريدي',  61),
  ('TESTOSTERONE','تستوستيرون',             'Testosterone',                  'هرمونات',       false, 'دم وريدي',  62),
  ('PROLACTIN', 'بروليكتين',               'Prolactin',                      'هرمونات',       false, 'دم وريدي',  63),
  ('CORTISOL',  'كورتيزول',                'Cortisol',                       'هرمونات',       false, 'دم وريدي',  64),
  ('INR',       'INR (تخثر للقلب)',         'INR / PT',                      'قلب وتخثر',     false, 'دم وريدي',  70),
  ('TROPONIN',  'تروبونين (ألم صدر)',        'Troponin',                      'قلب وتخثر',     false, 'دم وريدي',  71);

-- Radiology catalog
INSERT INTO lab_test_catalog (code, name_ar, name_en, category_ar, service_type, modality, sort_order) VALUES
  ('XRAY_CHEST',   'أشعة صدر',              'Chest X-Ray',              'أشعة سينية',     'radiology', 'xray',        100),
  ('XRAY_SPINE',   'أشعة عمود فقري',         'Spine X-Ray',              'أشعة سينية',     'radiology', 'xray',        101),
  ('XRAY_KNEE',    'أشعة ركبة',             'Knee X-Ray',               'أشعة سينية',     'radiology', 'xray',        102),
  ('XRAY_PELVIS',  'أشعة حوض',              'Pelvis X-Ray',             'أشعة سينية',     'radiology', 'xray',        103),
  ('US_ABDOMEN',   'سونار بطن',             'Abdominal Ultrasound',     'موجات صوتية',    'radiology', 'ultrasound',  110),
  ('US_PELVIS',    'سونار حوض',             'Pelvic Ultrasound',        'موجات صوتية',    'radiology', 'ultrasound',  111),
  ('US_THYROID',   'سونار غدة درقية',        'Thyroid Ultrasound',       'موجات صوتية',    'radiology', 'ultrasound',  112),
  ('US_NECK',      'سونار رقبة',             'Neck Ultrasound',          'موجات صوتية',    'radiology', 'ultrasound',  113),
  ('ECHO',         'إيكو قلب',              'Echocardiogram',           'موجات صوتية',    'radiology', 'ultrasound',  114),
  ('MRI_BRAIN',    'رنين مغناطيسي مخ',       'Brain MRI',                'رنين مغناطيسي',  'radiology', 'mri',         120),
  ('MRI_SPINE',    'رنين مغناطيسي عمود فقري','Spine MRI',               'رنين مغناطيسي',  'radiology', 'mri',         121),
  ('MRI_KNEE',     'رنين مغناطيسي ركبة',     'Knee MRI',                'رنين مغناطيسي',  'radiology', 'mri',         122),
  ('MRI_PELVIS',   'رنين مغناطيسي حوض',      'Pelvis MRI',              'رنين مغناطيسي',  'radiology', 'mri',         123),
  ('CT_CHEST',     'أشعة مقطعية صدر',        'CT Chest',                'أشعة مقطعية',    'radiology', 'ct',          130),
  ('CT_ABDOMEN',   'أشعة مقطعية بطن',        'CT Abdomen',              'أشعة مقطعية',    'radiology', 'ct',          131),
  ('CT_BRAIN',     'أشعة مقطعية مخ',         'CT Brain',                'أشعة مقطعية',    'radiology', 'ct',          132),
  ('MAMMO',        'ماموجرام',              'Mammography',              'تصوير متخصص',    'radiology', 'mammography', 140),
  ('DEXA',         'قياس كثافة العظام',       'Bone Density (DEXA)',      'تصوير متخصص',    'radiology', 'bone_density', 141);

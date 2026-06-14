-- Migration 021: Insurance Integration
-- Insurance providers, doctor-insurance junction, patient insurance preference

-- Insurance provider reference table
CREATE TABLE insurance_providers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  type        TEXT NOT NULL,  -- 'private' | 'government' | 'none'
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Seed the providers
INSERT INTO insurance_providers (code, name_ar, name_en, type, sort_order) VALUES
  ('axa',          'أكسا مصر',                    'AXA Egypt',           'private',    1),
  ('metlife',      'ميتلايف مصر',                 'MetLife Egypt',       'private',    2),
  ('allianz',      'أليانز مصر',                  'Allianz Egypt',       'private',    3),
  ('bupa',         'بيوبا مصر',                   'Bupa Egypt',          'private',    4),
  ('gig',          'جي آي جي مصر',                'GIG Egypt',           'private',    5),
  ('nhia',         'الهيئة العامة للتأمين الصحي', 'NHIA',               'government', 6),
  ('misr_life',    'مصر للتأمين على الحياة',       'Misr Life Insurance', 'government', 7),
  ('no_insurance', 'لا يوجد تأمين',               'No Insurance',        'none',       99);

-- Patient insurance preference
ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS insurance_provider_code TEXT
    REFERENCES insurance_providers(code);

-- Doctor insurance acceptance (structured junction table)
CREATE TABLE doctor_insurance (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id             UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  insurance_provider_id UUID NOT NULL REFERENCES insurance_providers(id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (doctor_id, insurance_provider_id)
);

CREATE INDEX idx_doctor_insurance_doctor   ON doctor_insurance (doctor_id);
CREATE INDEX idx_doctor_insurance_provider ON doctor_insurance (insurance_provider_id);

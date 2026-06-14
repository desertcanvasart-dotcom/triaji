-- ============================================================
-- Migration 043: Insurance Company Tenant Type
-- Insurance companies reference table + roles + config
-- ============================================================

ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'insurance';

-- Insurance company reference table (platform-level)
CREATE TABLE insurance_companies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT UNIQUE NOT NULL,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  logo_url        TEXT,
  hotline         TEXT,
  website         TEXT,
  has_api         BOOLEAN NOT NULL DEFAULT false,
  api_adapter_key TEXT,
  tenant_id       UUID REFERENCES tenants(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE insurance_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_insurance_companies" ON insurance_companies FOR SELECT USING (true);
CREATE POLICY "service_role_all_insurance_companies" ON insurance_companies FOR ALL USING (auth.role() = 'service_role');

-- Seed 5 Egyptian insurers
INSERT INTO insurance_companies (code, name_ar, name_en, hotline, has_api, sort_order) VALUES
  ('axa_egypt',      'AXA مصر',         'AXA Egypt',         '19225', false, 1),
  ('metlife_egypt',  'ميتلايف مصر',     'MetLife Egypt',     '19757', false, 2),
  ('allianz_egypt',  'أليانز مصر',      'Allianz Egypt',     '19007', false, 3),
  ('globemed_egypt', 'جلوبميد مصر',     'GlobeMed Egypt',    '19600', false, 4),
  ('medmark',        'ميدمارك',         'Medmark',           '16161', false, 5);

-- Insurance-specific config
ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS insurer_code              TEXT,
  ADD COLUMN IF NOT EXISTS pre_auth_required_for     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pre_auth_sla_hours        INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS urgent_preauth_sla_hours  INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS claims_submission_deadline_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reimbursement_rate        DECIMAL(5,2) DEFAULT 80.00;

-- Insurance staff roles
ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN (
    'platform_admin',
    'tenant_admin', 'tenant_manager',
    'clinic_owner', 'clinic_receptionist', 'clinic_billing', 'clinic_doctor',
    'lab_owner', 'lab_receptionist', 'lab_technician', 'lab_billing',
    'pharmacy_owner', 'pharmacy_staff', 'pharmacy_billing',
    'insurance_admin', 'insurance_reviewer', 'insurance_finance'
  ));

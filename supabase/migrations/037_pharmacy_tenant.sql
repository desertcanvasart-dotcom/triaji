-- ============================================================
-- Migration 037: Pharmacy Tenant Type
-- Prescription preparation + medication catalog
-- ============================================================

ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'pharmacy';

-- Pharmacy-specific config columns
ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS pharmacy_license_number TEXT,
  ADD COLUMN IF NOT EXISTS pharmacist_name_ar      TEXT,
  ADD COLUMN IF NOT EXISTS pharmacist_name_en      TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_type           TEXT DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS delivery_available      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_radius_km      INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS delivery_fee_egp        DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS accepts_insurance       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_providers     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prep_time_minutes       INTEGER DEFAULT 30;

-- Pharmacy staff roles
ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN (
    'platform_admin',
    'tenant_admin', 'tenant_manager',
    'clinic_owner', 'clinic_receptionist', 'clinic_billing', 'clinic_doctor',
    'lab_owner', 'lab_receptionist', 'lab_technician', 'lab_billing',
    'pharmacy_owner', 'pharmacy_staff', 'pharmacy_billing'
  ));

-- Pharmacy medication inventory
CREATE TABLE pharmacy_medications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drug_name_ar      TEXT NOT NULL,
  drug_name_en      TEXT,
  generic_name_en   TEXT,
  form_ar           TEXT,
  form_en           TEXT,
  strength          TEXT,
  manufacturer_ar   TEXT,
  price_egp         DECIMAL(10,2),
  in_stock          BOOLEAN NOT NULL DEFAULT true,
  stock_quantity    INTEGER,
  requires_prescription BOOLEAN NOT NULL DEFAULT true,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_pharm_meds_tenant ON pharmacy_medications (tenant_id);
ALTER TABLE pharmacy_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_pharmacy_medications" ON pharmacy_medications
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "public_read_pharmacy_medications" ON pharmacy_medications
  FOR SELECT USING (true);

-- Platform medication reference catalog
CREATE TABLE medication_catalog (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drug_name_ar    TEXT NOT NULL,
  drug_name_en    TEXT NOT NULL,
  generic_name_en TEXT,
  category_ar     TEXT,
  requires_prescription BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0
);

ALTER TABLE medication_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_medication_catalog" ON medication_catalog
  FOR SELECT USING (true);
CREATE POLICY "service_role_all_medication_catalog" ON medication_catalog
  FOR ALL USING (auth.role() = 'service_role');

-- Seed common Egyptian medications
INSERT INTO medication_catalog (drug_name_ar, drug_name_en, generic_name_en, category_ar, requires_prescription) VALUES
  ('أموكسيسيلين', 'Amoxicillin', 'Amoxicillin', 'مضادات حيوية', true),
  ('أزيثرومايسين', 'Azithromycin', 'Azithromycin', 'مضادات حيوية', true),
  ('سيبروفلوكساسين', 'Ciprofloxacin', 'Ciprofloxacin', 'مضادات حيوية', true),
  ('باراسيتامول', 'Paracetamol', 'Acetaminophen', 'مسكنات', false),
  ('إيبوبروفين', 'Ibuprofen', 'Ibuprofen', 'مسكنات', false),
  ('ديكلوفيناك', 'Diclofenac', 'Diclofenac', 'مسكنات', true),
  ('أملوديبين', 'Amlodipine', 'Amlodipine', 'أدوية ضغط', true),
  ('أتينولول', 'Atenolol', 'Atenolol', 'أدوية ضغط', true),
  ('ليزينوبريل', 'Lisinopril', 'Lisinopril', 'أدوية ضغط', true),
  ('لوسارتان', 'Losartan', 'Losartan', 'أدوية ضغط', true),
  ('ميتفورمين', 'Metformin', 'Metformin', 'أدوية سكر', true),
  ('جليبنكلاميد', 'Glibenclamide', 'Glibenclamide', 'أدوية سكر', true),
  ('إمباجليفلوزين', 'Empagliflozin', 'Empagliflozin', 'أدوية سكر', true),
  ('ليفوثيروكسين', 'Levothyroxine', 'Levothyroxine', 'أدوية غدة درقية', true),
  ('أوميبرازول', 'Omeprazole', 'Omeprazole', 'أدوية معدة', false),
  ('بانتوبرازول', 'Pantoprazole', 'Pantoprazole', 'أدوية معدة', true),
  ('أتورفاستاتين', 'Atorvastatin', 'Atorvastatin', 'كوليسترول', true),
  ('روسوفاستاتين', 'Rosuvastatin', 'Rosuvastatin', 'كوليسترول', true),
  ('سيتيريزين', 'Cetirizine', 'Cetirizine', 'مضادات حساسية', false),
  ('لوراتادين', 'Loratadine', 'Loratadine', 'مضادات حساسية', false);

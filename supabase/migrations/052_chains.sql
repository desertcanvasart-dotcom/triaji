-- ============================================================
-- Migration 052: Multi-Branch / Chain Model
-- Clinic + Lab + Pharmacy Chains
-- ============================================================

CREATE TYPE chain_type AS ENUM (
  'clinic_chain', 'lab_chain', 'radiology_chain',
  'pharmacy_chain', 'mixed'
);

CREATE TABLE chains (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar               TEXT NOT NULL,
  name_en               TEXT,
  slug                  TEXT UNIQUE,
  chain_type            chain_type NOT NULL,
  logo_url              TEXT,
  owner_account_id      UUID NOT NULL REFERENCES admin_users(id),
  main_phone            TEXT,
  main_email            TEXT,
  website               TEXT,
  shared_pricing        BOOLEAN NOT NULL DEFAULT true,
  shared_patient_records BOOLEAN NOT NULL DEFAULT true,
  primary_color         TEXT DEFAULT '#0D7A7A',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chains_owner ON chains (owner_account_id);
CREATE INDEX idx_chains_slug  ON chains (slug);

ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_chains" ON chains FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "public_read_chains" ON chains FOR SELECT USING (is_active = true);

-- ── Link tenants to chains ──────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS chain_id       UUID REFERENCES chains(id),
  ADD COLUMN IF NOT EXISTS branch_name_ar TEXT,
  ADD COLUMN IF NOT EXISTS branch_name_en TEXT,
  ADD COLUMN IF NOT EXISTS branch_number  INTEGER;

CREATE INDEX idx_tenants_chain ON tenants (chain_id);

-- ── Chain roles ─────────────────────────────────────────────

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
    'insurance_admin', 'insurance_reviewer', 'insurance_finance',
    'icu_coordinator',
    'chain_owner',
    'branch_manager'
  ));

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS chain_id         UUID REFERENCES chains(id),
  ADD COLUMN IF NOT EXISTS branch_tenant_id UUID REFERENCES tenants(id);

-- ── Chain pricing catalog ───────────────────────────────────

CREATE TABLE chain_pricing (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id                UUID NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  service_type            TEXT NOT NULL,
  service_code            TEXT,
  service_name_ar         TEXT NOT NULL,
  service_name_en         TEXT,
  price_egp               DECIMAL(10,2) NOT NULL,
  urgent_price_egp        DECIMAL(10,2),
  applies_to_all_branches BOOLEAN NOT NULL DEFAULT true,
  branch_exceptions       JSONB DEFAULT '[]',
  is_active               BOOLEAN NOT NULL DEFAULT true,
  effective_from          DATE DEFAULT CURRENT_DATE,
  sort_order              INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chain_pricing_chain ON chain_pricing (chain_id);
CREATE INDEX idx_chain_pricing_type  ON chain_pricing (service_type);

ALTER TABLE chain_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_chain_pricing" ON chain_pricing FOR ALL USING (auth.role() = 'service_role');

-- ── Chain patient registry ──────────────────────────────────

CREATE TABLE chain_patient_registry (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id             UUID NOT NULL REFERENCES chains(id),
  patient_id           UUID NOT NULL REFERENCES patients(id),
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_branch_id      UUID NOT NULL REFERENCES tenants(id),
  total_visits         INTEGER NOT NULL DEFAULT 1,
  last_visit_branch_id UUID REFERENCES tenants(id),
  last_visit_at        TIMESTAMPTZ,
  UNIQUE (chain_id, patient_id)
);

CREATE INDEX idx_chain_patients_chain   ON chain_patient_registry (chain_id);
CREATE INDEX idx_chain_patients_patient ON chain_patient_registry (patient_id);

ALTER TABLE chain_patient_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_chain_patients" ON chain_patient_registry FOR ALL USING (auth.role() = 'service_role');

-- ── Doctor branch assignments ───────────────────────────────

CREATE TABLE doctor_branch_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id    UUID NOT NULL REFERENCES chains(id),
  doctor_id   UUID NOT NULL REFERENCES doctors(id),
  branch_ids  UUID[] NOT NULL,
  schedule    JSONB DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, doctor_id)
);

CREATE INDEX idx_doctor_branches_chain  ON doctor_branch_assignments (chain_id);
CREATE INDEX idx_doctor_branches_doctor ON doctor_branch_assignments (doctor_id);

ALTER TABLE doctor_branch_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_doctor_branches" ON doctor_branch_assignments FOR ALL USING (auth.role() = 'service_role');

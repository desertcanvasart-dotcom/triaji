-- ============================================================
-- Migration 044: Insurance Policies, Pre-Auth, Claims, Remittance
-- Full three-party transaction pipeline
-- ============================================================

-- ── Patient Insurance Policies ──────────────────────────────

CREATE TYPE policy_status AS ENUM (
  'active', 'suspended', 'expired', 'pending_verification', 'unverified'
);

CREATE TABLE patient_insurance_policies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  insurer_code      TEXT NOT NULL,
  insurer_tenant_id UUID REFERENCES tenants(id),
  policy_number     TEXT NOT NULL,
  card_number       TEXT,
  member_name_ar    TEXT,
  employer_ar       TEXT,
  coverage_start    DATE,
  coverage_end      DATE,
  annual_limit_egp  DECIMAL(12,2),
  used_limit_egp    DECIMAL(12,2) DEFAULT 0,
  remaining_limit_egp DECIMAL(12,2) GENERATED ALWAYS AS
    (COALESCE(annual_limit_egp, 0) - COALESCE(used_limit_egp, 0)) STORED,
  copay_pct         DECIMAL(5,2) DEFAULT 20.00,
  status            policy_status NOT NULL DEFAULT 'unverified',
  last_verified_at  TIMESTAMPTZ,
  verified_by       TEXT,
  card_image_url    TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT true,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policies_patient ON patient_insurance_policies (patient_id);
CREATE INDEX idx_policies_insurer ON patient_insurance_policies (insurer_code);
CREATE INDEX idx_policies_active  ON patient_insurance_policies (patient_id, is_active);

ALTER TABLE patient_insurance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_policies" ON patient_insurance_policies FOR ALL USING (auth.role() = 'service_role');

-- ── Pre-Authorization Requests ──────────────────────────────

CREATE TYPE preauth_status AS ENUM (
  'submitted', 'under_review', 'approved', 'approved_partial',
  'denied', 'expired', 'cancelled'
);

CREATE TABLE pre_authorization_requests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id),
  policy_id             UUID NOT NULL REFERENCES patient_insurance_policies(id),
  insurer_tenant_id     UUID REFERENCES tenants(id),
  insurer_code          TEXT NOT NULL,
  requesting_tenant_id  UUID NOT NULL REFERENCES tenants(id),
  requesting_doctor_id  UUID REFERENCES doctors(id),
  procedure_type        TEXT NOT NULL,
  procedure_description_ar TEXT NOT NULL,
  procedure_description_en TEXT,
  icd10_code            TEXT,
  estimated_cost_egp    DECIMAL(10,2),
  clinical_justification_ar TEXT NOT NULL,
  clinical_justification_en TEXT,
  urgency               TEXT NOT NULL DEFAULT 'routine',
  health_record_id      UUID REFERENCES health_records(id),
  referral_id           UUID REFERENCES referrals(id),
  status                preauth_status NOT NULL DEFAULT 'submitted',
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES admin_users(id),
  approved_amount_egp   DECIMAL(10,2),
  approval_conditions_ar TEXT,
  denial_reason_ar      TEXT,
  denial_code           TEXT,
  preauth_reference     TEXT,
  valid_from            DATE,
  valid_until           DATE,
  appeal_submitted_at   TIMESTAMPTZ,
  appeal_reason_ar      TEXT,
  appeal_status         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preauth_patient  ON pre_authorization_requests (patient_id);
CREATE INDEX idx_preauth_insurer  ON pre_authorization_requests (insurer_tenant_id);
CREATE INDEX idx_preauth_provider ON pre_authorization_requests (requesting_tenant_id);
CREATE INDEX idx_preauth_status   ON pre_authorization_requests (status);

ALTER TABLE pre_authorization_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_preauth" ON pre_authorization_requests FOR ALL USING (auth.role() = 'service_role');

-- ── Insurance Claims ────────────────────────────────────────

CREATE TYPE claim_status AS ENUM (
  'draft', 'submitted', 'under_review', 'approved', 'approved_partial',
  'paid', 'rejected', 'appealed', 'closed'
);

CREATE TYPE claim_type AS ENUM (
  'consultation', 'lab_test', 'imaging', 'medication', 'procedure', 'hospitalization'
);

CREATE TABLE insurance_claims (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_number          TEXT NOT NULL UNIQUE,
  claim_type            claim_type NOT NULL,
  patient_id            UUID NOT NULL REFERENCES patients(id),
  policy_id             UUID NOT NULL REFERENCES patient_insurance_policies(id),
  insurer_code          TEXT NOT NULL,
  insurer_tenant_id     UUID REFERENCES tenants(id),
  provider_tenant_id    UUID NOT NULL REFERENCES tenants(id),
  provider_type         TEXT NOT NULL,
  treating_doctor_id    UUID REFERENCES doctors(id),
  clinic_invoice_id     UUID REFERENCES clinic_invoices(id),
  pharmacy_invoice_id   UUID REFERENCES pharmacy_invoices(id),
  booking_id            UUID REFERENCES bookings(id),
  health_record_id      UUID REFERENCES health_records(id),
  preauth_id            UUID REFERENCES pre_authorization_requests(id),
  total_amount_egp      DECIMAL(10,2) NOT NULL,
  claimed_amount_egp    DECIMAL(10,2) NOT NULL,
  approved_amount_egp   DECIMAL(10,2),
  patient_copay_egp     DECIMAL(10,2),
  provider_receives_egp DECIMAL(10,2),
  line_items            JSONB NOT NULL DEFAULT '[]',
  status                claim_status NOT NULL DEFAULT 'draft',
  submitted_at          TIMESTAMPTZ,
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES admin_users(id),
  rejection_reason_ar   TEXT,
  rejection_code        TEXT,
  partial_approval_notes_ar TEXT,
  remittance_id         UUID,
  paid_at               TIMESTAMPTZ,
  appeal_submitted_at   TIMESTAMPTZ,
  appeal_reason_ar      TEXT,
  appeal_outcome        TEXT,
  submission_deadline   DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_patient   ON insurance_claims (patient_id);
CREATE INDEX idx_claims_insurer   ON insurance_claims (insurer_tenant_id);
CREATE INDEX idx_claims_provider  ON insurance_claims (provider_tenant_id);
CREATE INDEX idx_claims_status    ON insurance_claims (status);
CREATE INDEX idx_claims_deadline  ON insurance_claims (submission_deadline) WHERE status = 'draft';

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_claims" ON insurance_claims FOR ALL USING (auth.role() = 'service_role');

-- ── Remittance Records ──────────────────────────────────────

CREATE TABLE remittance_records (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insurer_tenant_id  UUID NOT NULL REFERENCES tenants(id),
  provider_tenant_id UUID NOT NULL REFERENCES tenants(id),
  insurer_code       TEXT NOT NULL,
  remittance_number  TEXT NOT NULL UNIQUE,
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  total_claims       INTEGER NOT NULL DEFAULT 0,
  total_amount_egp   DECIMAL(12,2) NOT NULL,
  status             TEXT NOT NULL DEFAULT 'issued',
  paid_at            TIMESTAMPTZ,
  payment_reference  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE insurance_claims
  ADD CONSTRAINT fk_remittance
  FOREIGN KEY (remittance_id) REFERENCES remittance_records(id);

ALTER TABLE remittance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_remittance" ON remittance_records FOR ALL USING (auth.role() = 'service_role');

-- ── Number generators ───────────────────────────────────────

CREATE OR REPLACE FUNCTION next_claim_number(p_insurer_code TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(claim_number FROM '\d+$') AS INTEGER)
  ), 0) + 1 INTO next_seq
  FROM insurance_claims
  WHERE insurer_code = p_insurer_code
    AND claim_number LIKE 'CLM-' || UPPER(p_insurer_code) || '-' || current_year || '-%';
  RETURN 'CLM-' || UPPER(p_insurer_code) || '-' || current_year || '-' || LPAD(next_seq::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_remittance_number(p_insurer_code TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(remittance_number FROM '\d+$') AS INTEGER)
  ), 0) + 1 INTO next_seq
  FROM remittance_records
  WHERE insurer_code = p_insurer_code
    AND remittance_number LIKE 'RMT-' || UPPER(p_insurer_code) || '-' || current_year || '-%';
  RETURN 'RMT-' || UPPER(p_insurer_code) || '-' || current_year || '-' || LPAD(next_seq::TEXT, 5, '0');
END;
$$;

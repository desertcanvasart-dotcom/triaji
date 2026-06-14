-- ============================================================
-- Migration 049: Payment Gateway Integration
-- Fawry + Paymob + Vodafone Cash
-- ============================================================

CREATE TYPE payment_provider AS ENUM (
  'fawry', 'paymob', 'vodafone_cash'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'processing', 'completed', 'failed',
  'expired', 'refunded', 'partial_refund'
);

CREATE TYPE payable_type AS ENUM (
  'booking', 'clinic_invoice', 'lab_invoice',
  'pharmacy_invoice', 'insurance_copay'
);

CREATE TABLE payment_transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payable_type          payable_type NOT NULL,
  payable_id            UUID NOT NULL,
  patient_id            UUID NOT NULL REFERENCES patients(id),
  provider              payment_provider NOT NULL,
  provider_order_id     TEXT,
  fawry_code            TEXT,
  amount_egp            DECIMAL(10,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'EGP',
  status                payment_status NOT NULL DEFAULT 'pending',
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  expired_at            TIMESTAMPTZ,
  failure_reason        TEXT,
  payment_method_detail TEXT,
  webhook_received_at   TIMESTAMPTZ,
  webhook_payload       JSONB,
  refunded_amount_egp   DECIMAL(10,2) DEFAULT 0,
  refund_reason         TEXT,
  refunded_at           TIMESTAMPTZ,
  receipt_url           TEXT,
  receipt_sent          BOOLEAN NOT NULL DEFAULT false,
  triaji_reference      TEXT NOT NULL UNIQUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_patient    ON payment_transactions (patient_id);
CREATE INDEX idx_payments_payable    ON payment_transactions (payable_type, payable_id);
CREATE INDEX idx_payments_provider   ON payment_transactions (provider);
CREATE INDEX idx_payments_status     ON payment_transactions (status);
CREATE INDEX idx_payments_reference  ON payment_transactions (triaji_reference);
CREATE INDEX idx_payments_fawry_code ON payment_transactions (fawry_code) WHERE fawry_code IS NOT NULL;
CREATE INDEX idx_payments_pending    ON payment_transactions (status, created_at) WHERE status = 'pending';

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_payments" ON payment_transactions FOR ALL USING (auth.role() = 'service_role');

-- ── Payment Reference Sequence ──────────────────────────────

CREATE SEQUENCE IF NOT EXISTS payment_reference_seq START 1;

CREATE OR REPLACE FUNCTION next_payment_reference()
RETURNS TEXT AS $$
  SELECT 'PAY-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
         LPAD(nextval('payment_reference_seq')::TEXT, 6, '0');
$$ LANGUAGE sql;

-- ── Tenant Payment Config ───────────────────────────────────

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS accepts_online_payment  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_providers       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fawry_merchant_code     TEXT,
  ADD COLUMN IF NOT EXISTS paymob_integration_id   TEXT,
  ADD COLUMN IF NOT EXISTS vf_merchant_code        TEXT,
  ADD COLUMN IF NOT EXISTS payment_split_pct       DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_account_name_ar    TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_iban       TEXT;

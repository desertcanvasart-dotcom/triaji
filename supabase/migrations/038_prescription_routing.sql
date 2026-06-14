-- ============================================================
-- Migration 038: Prescription Routing + Pharmacy Invoices
-- Digital prescription-to-dispensing pipeline
-- ============================================================

CREATE TYPE prescription_routing_status AS ENUM (
  'prescribed',
  'routed',
  'received',
  'checking_stock',
  'ready',
  'partial_ready',
  'collected',
  'cancelled'
);

CREATE TABLE prescription_routing (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  health_record_id      UUID NOT NULL REFERENCES health_records(id),
  pharmacy_tenant_id    UUID NOT NULL REFERENCES tenants(id),
  doctor_id             UUID NOT NULL REFERENCES doctors(id),
  doctor_account_id     UUID REFERENCES doctor_accounts(id),
  patient_id            UUID NOT NULL REFERENCES patients(id),
  patient_phone         TEXT NOT NULL,

  status                prescription_routing_status NOT NULL DEFAULT 'prescribed',
  routed_at             TIMESTAMPTZ,
  received_at           TIMESTAMPTZ,
  ready_at              TIMESTAMPTZ,
  collected_at          TIMESTAMPTZ,
  estimated_ready_at    TIMESTAMPTZ,

  stock_confirmation    JSONB DEFAULT '[]',
  delivery_requested    BOOLEAN NOT NULL DEFAULT false,
  delivery_address_ar   TEXT,
  invoice_id            UUID,

  routing_note_ar       TEXT,
  pharmacy_note_ar      TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_presc_routing_pharmacy ON prescription_routing (pharmacy_tenant_id);
CREATE INDEX idx_presc_routing_doctor   ON prescription_routing (doctor_id);
CREATE INDEX idx_presc_routing_patient  ON prescription_routing (patient_id);
CREATE INDEX idx_presc_routing_status   ON prescription_routing (status);

ALTER TABLE prescription_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_prescription_routing" ON prescription_routing
  FOR ALL USING (auth.role() = 'service_role');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE prescription_routing;

-- Pharmacy invoices
CREATE TABLE pharmacy_invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  routing_id        UUID NOT NULL REFERENCES prescription_routing(id),
  patient_id        UUID REFERENCES patients(id),
  patient_name_ar   TEXT NOT NULL,
  doctor_id         UUID NOT NULL REFERENCES doctors(id),
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number    TEXT NOT NULL,

  line_items        JSONB NOT NULL DEFAULT '[]',
  subtotal_egp      DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_egp      DECIMAL(10,2) NOT NULL DEFAULT 0,
  insurance_covered DECIMAL(10,2) NOT NULL DEFAULT 0,
  patient_pays_egp  DECIMAL(10,2) NOT NULL DEFAULT 0,

  status            invoice_status NOT NULL DEFAULT 'draft',
  payment_method    payment_method,
  paid_at           TIMESTAMPTZ,
  whatsapp_sent     BOOLEAN NOT NULL DEFAULT false,

  notes_ar          TEXT,
  created_by        UUID REFERENCES admin_users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prescription_routing
  ADD CONSTRAINT fk_pharmacy_invoice
  FOREIGN KEY (invoice_id) REFERENCES pharmacy_invoices(id);

CREATE INDEX idx_pharm_invoices_tenant  ON pharmacy_invoices (tenant_id);
CREATE INDEX idx_pharm_invoices_date    ON pharmacy_invoices (invoice_date);
CREATE INDEX idx_pharm_invoices_patient ON pharmacy_invoices (patient_id);

ALTER TABLE pharmacy_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_pharmacy_invoices" ON pharmacy_invoices
  FOR ALL USING (auth.role() = 'service_role');

-- Dispensing columns on health_records
ALTER TABLE health_records
  ADD COLUMN IF NOT EXISTS dispensed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispensed_by_pharmacy  UUID REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS dispensing_notes_ar    TEXT;

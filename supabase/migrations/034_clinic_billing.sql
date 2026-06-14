-- ============================================================
-- Migration 034: Clinic Billing
-- Basic invoice tracking per visit
-- ============================================================

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'issued',
  'paid',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'cash',
  'card',
  'insurance',
  'bank_transfer',
  'partial_insurance'
);

CREATE TABLE clinic_invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  queue_entry_id    UUID REFERENCES clinic_queue(id),
  booking_id        UUID REFERENCES bookings(id),
  patient_id        UUID REFERENCES patients(id),
  patient_name_ar   TEXT NOT NULL,
  doctor_id         UUID NOT NULL REFERENCES doctors(id),
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number    TEXT NOT NULL,

  -- Line items: [{ description_ar, qty, unit_price_egp }]
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

-- Indexes
CREATE UNIQUE INDEX idx_invoices_tenant_number ON clinic_invoices (tenant_id, invoice_number);
CREATE INDEX idx_invoices_tenant_date  ON clinic_invoices (tenant_id, invoice_date);
CREATE INDEX idx_invoices_doctor_date  ON clinic_invoices (doctor_id, invoice_date);
CREATE INDEX idx_invoices_patient      ON clinic_invoices (patient_id);
CREATE INDEX idx_invoices_status       ON clinic_invoices (status);

-- RLS
ALTER TABLE clinic_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_clinic_invoices" ON clinic_invoices
  FOR ALL USING (auth.role() = 'service_role');

-- Invoice number generator: INV-YYYY-NNNNN (tenant-scoped, year-partitioned)
CREATE OR REPLACE FUNCTION next_invoice_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM clinic_invoices
  WHERE tenant_id = p_tenant_id
    AND invoice_number LIKE 'INV-' || current_year || '-%';

  RETURN 'INV-' || current_year || '-' || LPAD(next_seq::TEXT, 5, '0');
END;
$$;

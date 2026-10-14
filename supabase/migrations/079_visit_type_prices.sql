-- Migration 079: visit types carry a price (كشف / استشارة / إعادة …)
--
-- doctor_visit_types (migration 075) already names a doctor's kinds of visit
-- and their slot length. Doctors charge differently per kind, so each type now
-- has an optional price. The Today screen uses it to pre-fill invoices, and
-- invoices / walk-ins remember their visit type so reports can split income by
-- type. A type without a price falls back to doctors.consultation_fee_egp.

ALTER TABLE doctor_visit_types
  ADD COLUMN IF NOT EXISTS price_egp DECIMAL(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_visit_types_price_nonneg'
  ) THEN
    ALTER TABLE doctor_visit_types
      ADD CONSTRAINT doctor_visit_types_price_nonneg CHECK (price_egp IS NULL OR price_egp >= 0);
  END IF;
END $$;

ALTER TABLE clinic_queue
  ADD COLUMN IF NOT EXISTS visit_type_id UUID REFERENCES doctor_visit_types(id) ON DELETE SET NULL;

ALTER TABLE clinic_invoices
  ADD COLUMN IF NOT EXISTS visit_type_id UUID REFERENCES doctor_visit_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_visit_type ON clinic_invoices (visit_type_id) WHERE visit_type_id IS NOT NULL;

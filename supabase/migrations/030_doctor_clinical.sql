-- Phase 15: Post-Consultation Clinical Documents
-- Migration 030

-- Signature and stamp on doctor_accounts
ALTER TABLE doctor_accounts
  ADD COLUMN IF NOT EXISTS signature_url      TEXT,
  ADD COLUMN IF NOT EXISTS stamp_url          TEXT,
  ADD COLUMN IF NOT EXISTS use_text_stamp     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clinic_name_en     TEXT,
  ADD COLUMN IF NOT EXISTS clinic_address_ar  TEXT,
  ADD COLUMN IF NOT EXISTS clinic_address_en  TEXT,
  ADD COLUMN IF NOT EXISTS clinic_phone       TEXT;

-- Doctor-authored extensions on health_records
ALTER TABLE health_records
  ADD COLUMN IF NOT EXISTS doctor_authored    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS authored_by        UUID REFERENCES doctor_accounts(id),
  ADD COLUMN IF NOT EXISTS booking_id         UUID REFERENCES bookings(id),
  ADD COLUMN IF NOT EXISTS document_type      TEXT,
  -- 'prescription' | 'lab_order' | 'imaging_order' | 'consultation_summary'
  ADD COLUMN IF NOT EXISTS document_number    TEXT,
  -- Format: TRJ-{year}-{padded 5-digit sequence} e.g. TRJ-2026-00142
  ADD COLUMN IF NOT EXISTS whatsapp_sent      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_url            TEXT;

-- Prescription items
CREATE TABLE IF NOT EXISTS prescription_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  health_record_id UUID NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
  drug_name_ar     TEXT NOT NULL,
  drug_name_en     TEXT,
  dose             TEXT NOT NULL,
  route            TEXT,
  frequency_ar     TEXT NOT NULL,
  frequency_en     TEXT,
  duration_ar      TEXT,
  duration_en      TEXT,
  instructions_ar  TEXT,
  instructions_en  TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0
);

-- Lab test order items
CREATE TABLE IF NOT EXISTS lab_order_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  health_record_id UUID NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
  test_name_ar     TEXT NOT NULL,
  test_name_en     TEXT,
  urgency          TEXT NOT NULL DEFAULT 'routine',
  fasting_required BOOLEAN NOT NULL DEFAULT false,
  notes_ar         TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0
);

-- Imaging order items
CREATE TABLE IF NOT EXISTS imaging_order_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  health_record_id UUID NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
  modality         TEXT NOT NULL,
  modality_ar      TEXT NOT NULL,
  body_region_ar   TEXT NOT NULL,
  body_region_en   TEXT,
  laterality       TEXT,
  contrast         BOOLEAN DEFAULT false,
  clinical_indication_ar TEXT,
  clinical_indication_en TEXT,
  urgency          TEXT NOT NULL DEFAULT 'routine',
  sort_order       INTEGER NOT NULL DEFAULT 0
);

-- Consultation summary extensions
ALTER TABLE session_summaries
  ADD COLUMN IF NOT EXISTS doctor_history_ar        TEXT,
  ADD COLUMN IF NOT EXISTS doctor_history_en        TEXT,
  ADD COLUMN IF NOT EXISTS doctor_examination_ar    TEXT,
  ADD COLUMN IF NOT EXISTS doctor_examination_en    TEXT,
  ADD COLUMN IF NOT EXISTS doctor_assessment_ar     TEXT,
  ADD COLUMN IF NOT EXISTS doctor_assessment_en     TEXT,
  ADD COLUMN IF NOT EXISTS doctor_plan_ar           TEXT,
  ADD COLUMN IF NOT EXISTS doctor_plan_en           TEXT,
  ADD COLUMN IF NOT EXISTS doctor_followup_ar       TEXT,
  ADD COLUMN IF NOT EXISTS summary_pdf_url          TEXT,
  ADD COLUMN IF NOT EXISTS summary_whatsapp_sent    BOOLEAN NOT NULL DEFAULT false;

-- Document number sequence
CREATE SEQUENCE IF NOT EXISTS document_number_seq START 1;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_records_doctor
  ON health_records (authored_by);
CREATE INDEX IF NOT EXISTS idx_health_records_booking
  ON health_records (booking_id);
CREATE INDEX IF NOT EXISTS idx_prescription_record
  ON prescription_items (health_record_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_record
  ON lab_order_items (health_record_id);
CREATE INDEX IF NOT EXISTS idx_imaging_order_record
  ON imaging_order_items (health_record_id);

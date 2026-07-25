-- 068_doctor_documents.sql
-- Verification documents for doctor registrations.
--
-- Registration itself stays text-only: a doctor signs up, lands on "pending",
-- and uploads their paperwork afterwards while the account is under review.
-- Each document is reviewed individually so an admin can ask for one bad scan
-- again instead of rejecting the whole application.

CREATE TYPE doctor_document_type AS ENUM (
  -- Personal
  'syndicate_card',        -- كارنيه النقابة
  'national_id',           -- بطاقة الرقم القومي
  'degree',                -- شهادة التخرج
  'specialty_certificate', -- شهادة التخصص / الزمالة
  -- Clinic (only meaningful when clinic_mode = 'own_clinic')
  'clinic_license',        -- ترخيص العيادة
  'commercial_register',   -- السجل التجاري
  'tax_card'               -- البطاقة الضريبية
);

CREATE TYPE doctor_document_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS doctor_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_account_id UUID NOT NULL REFERENCES doctor_accounts(id) ON DELETE CASCADE,

  doc_type          doctor_document_type NOT NULL,
  storage_path      TEXT NOT NULL UNIQUE,   -- path inside the doctor-documents bucket
  file_name         TEXT NOT NULL,          -- original name, shown to both sides
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,

  status            doctor_document_status NOT NULL DEFAULT 'pending',
  review_note       TEXT,                   -- why it was rejected, shown to the doctor
  reviewed_by       UUID REFERENCES admin_users(id),
  reviewed_at       TIMESTAMPTZ,

  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_documents_account ON doctor_documents (doctor_account_id);
CREATE INDEX IF NOT EXISTS idx_doctor_documents_status  ON doctor_documents (status);

ALTER TABLE doctor_documents ENABLE ROW LEVEL SECURITY;

-- Doctors see and manage only their own documents.
DROP POLICY IF EXISTS doctor_own_documents ON doctor_documents;
CREATE POLICY doctor_own_documents ON doctor_documents
  FOR ALL USING (doctor_account_id = auth.uid());

-- Platform admins see everything (the verification queue).
DROP POLICY IF EXISTS platform_admin_all_documents ON doctor_documents;
CREATE POLICY platform_admin_all_documents ON doctor_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ─── Storage buckets ────────────────────────────────────────────────────────
-- doctor-documents holds national IDs and syndicate cards, so it is private and
-- only ever read through short-lived signed URLs minted server-side.
--
-- doctor-assets and session-images were referenced in application code
-- (signature/stamp upload, triage image upload) but had never been created —
-- both uploads failed at runtime with "Bucket not found".

INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor-documents', 'doctor-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor-assets', 'doctor-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('session-images', 'session-images', false)
ON CONFLICT (id) DO NOTHING;

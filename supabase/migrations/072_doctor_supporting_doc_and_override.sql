-- 072_doctor_supporting_doc_and_override.sql
-- Two additions for handling verification edge cases:
--
--   1. `supporting_document` — a flexible, optional slot so a doctor in an
--      unusual situation can upload extra proof that doesn't fit the fixed
--      checklist. Reviewed like any other document.
--
--   2. `verification_note` — free text recorded when a platform admin verifies a
--      doctor as a special case (overriding the "all required documents
--      approved" gate). It captures WHY the exception was made, for audit.
--
-- Additive and safe: existing rows and pre-migration code keep working.

ALTER TYPE doctor_document_type ADD VALUE IF NOT EXISTS 'supporting_document';

ALTER TABLE doctor_accounts
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

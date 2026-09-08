-- 071_doctor_id_sides_foreign_degree.sql
-- Two follow-ups to the doctor verification documents (migration 068):
--
--   1. The National ID is a two-sided card, but the checklist only had one
--      `national_id` slot, so a doctor could upload the front OR the back, never
--      both. We keep `national_id` as the FRONT (existing uploads stay valid)
--      and add `national_id_back` for the reverse.
--
--   2. Doctors and dentists who earned their degree abroad must prove the
--      Egyptian Supreme Council of Universities has recognised it. That is a
--      distinct document, only required when the degree is foreign — so we add a
--      `foreign_degree_equivalency` document type and a `foreign_degree` flag on
--      the registration that turns the requirement on.
--
-- All changes are additive: existing rows and the pre-migration code paths keep
-- working (the app degrades gracefully until this is applied).

-- New enum values. ADD VALUE is idempotent with IF NOT EXISTS and, on PG 12+,
-- is safe to run here because we never reference the new values in this file.
ALTER TYPE doctor_document_type ADD VALUE IF NOT EXISTS 'national_id_back';
ALTER TYPE doctor_document_type ADD VALUE IF NOT EXISTS 'foreign_degree_equivalency';

-- Whether the doctor's medical degree is from a university outside Egypt. When
-- true, the equivalency document above becomes required for approval.
ALTER TABLE doctor_accounts
  ADD COLUMN IF NOT EXISTS foreign_degree BOOLEAN NOT NULL DEFAULT false;

-- 063_clinical_document_number.sql
-- Atomic clinical-document numbering.
--
-- clinical-document creation numbered docs as
--   count(health_records WHERE doctor_authored) + 1  →  TRJ-YYYY-NNNNN
-- then used that as a storage path with upsert:false. Two concurrent creations
-- read the same count → duplicate document numbers and an upload collision/500.
--
-- This replaces the count with a single-row counter incremented atomically via
-- UPDATE ... RETURNING (row lock serializes concurrent callers). Semantics are
-- unchanged: a global monotonic sequence, labelled with the current year. The
-- counter is seeded to the current doctor-authored count so new numbers never
-- collide with documents already stored under the old scheme.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS clinical_document_counter (
  id       INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seq INT NOT NULL DEFAULT 0
);

INSERT INTO clinical_document_counter (id, last_seq)
SELECT 1, COUNT(*)::INT FROM health_records WHERE doctor_authored = true
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION next_clinical_document_number()
RETURNS TEXT AS $$
DECLARE
  n INT;
BEGIN
  UPDATE clinical_document_counter
  SET last_seq = last_seq + 1
  WHERE id = 1
  RETURNING last_seq INTO n;

  RETURN 'TRJ-' || EXTRACT(YEAR FROM now())::INT || '-' || lpad(n::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

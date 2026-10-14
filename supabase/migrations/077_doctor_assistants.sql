-- Migration 077: doctor_assistants — front-desk helpers a doctor manages
--
-- A doctor running their own clinic can add up to two assistants (enforced in
-- the app). An assistant signs in on the doctor login page with their own
-- email + password and works the doctor's day: check-ins, walk-ins, calling
-- patients, the waiting-room screen and a read-only calendar. They never see
-- exams, prescriptions or patient records — every other doctor route looks the
-- user up in doctor_accounts, where an assistant has no row.
--
-- id is the assistant's auth user, so deleting that user removes the row.

CREATE TABLE IF NOT EXISTS doctor_assistants (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_account_id  UUID NOT NULL REFERENCES doctor_accounts(id) ON DELETE CASCADE,
  doctor_id          UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone              TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_assistants_name_len CHECK (char_length(name) BETWEEN 2 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_doctor_assistants_account ON doctor_assistants (doctor_account_id);

ALTER TABLE doctor_assistants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON doctor_assistants;
CREATE POLICY service_role_all ON doctor_assistants
  FOR ALL USING (auth.role() = 'service_role');

-- The doctor sees their assistants; an assistant sees their own row.
DROP POLICY IF EXISTS doctor_assistants_read ON doctor_assistants;
CREATE POLICY doctor_assistants_read ON doctor_assistants
  FOR SELECT USING (doctor_account_id = auth.uid() OR id = auth.uid());

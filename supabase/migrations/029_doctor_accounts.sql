-- Phase 14: Doctor Mode — doctor_accounts table + doctor_notes on session_summaries
-- Migration 029

-- Verification status enum
CREATE TYPE doctor_verification_status AS ENUM (
  'pending',    -- registered, awaiting manual review
  'verified',   -- Syndicate number confirmed
  'rejected',   -- verification failed
  'suspended'   -- account suspended
);

-- Doctor accounts table (separate from admin_users and patients)
CREATE TABLE doctor_accounts (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id             UUID REFERENCES doctors(id),
  -- NULL if doctor self-registered and not yet matched to a doctors record
  -- Populated when admin matches their registration to an existing doctor profile

  name_ar               TEXT NOT NULL,
  name_en               TEXT,
  syndicate_number      TEXT NOT NULL UNIQUE,
  -- Egyptian Medical Syndicate number (رقم نقابة الأطباء)
  specialty_ar          TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  email                 TEXT NOT NULL,
  governorate_id        UUID REFERENCES governorates(id),
  clinic_name_ar        TEXT,

  verification_status   doctor_verification_status NOT NULL DEFAULT 'pending',
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES admin_users(id),
  -- Platform admin who approved the verification
  rejection_reason      TEXT,

  -- Self-registration flag
  self_registered       BOOLEAN NOT NULL DEFAULT true,
  -- false = added by hospital admin, true = self-registered via /ar/doctor

  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE doctor_accounts ENABLE ROW LEVEL SECURITY;

-- Doctors see only their own account
CREATE POLICY doctor_own_account ON doctor_accounts
  FOR ALL USING (id = auth.uid());

-- Platform admins see all (for verification workflow)
CREATE POLICY platform_admin_all_doctors ON doctor_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE INDEX idx_doctor_accounts_syndicate ON doctor_accounts (syndicate_number);
CREATE INDEX idx_doctor_accounts_status    ON doctor_accounts (verification_status);
CREATE INDEX idx_doctor_accounts_doctor_id ON doctor_accounts (doctor_id);

-- Add doctor notes columns to session_summaries
ALTER TABLE session_summaries
  ADD COLUMN IF NOT EXISTS doctor_notes_ar TEXT,
  ADD COLUMN IF NOT EXISTS doctor_notes_added_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id);

-- Add 'doctor_intake' to session_channel enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'doctor_intake'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'session_channel')
  ) THEN
    ALTER TYPE session_channel ADD VALUE 'doctor_intake';
  END IF;
END
$$;

-- Add 'phone_call' to session_channel enum if not already there
-- (might already exist from Phase 11)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'phone_call'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'session_channel')
  ) THEN
    ALTER TYPE session_channel ADD VALUE 'phone_call';
  END IF;
END
$$;

-- Add appointment_type to bookings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'appointment_type'
  ) THEN
    ALTER TABLE bookings ADD COLUMN appointment_type TEXT DEFAULT 'in_person';
  END IF;
END
$$;

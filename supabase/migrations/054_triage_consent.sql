-- Migration 054: Triage Consent Columns
-- Tracks explicit patient consent given during mid-conversation sign-up gate

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS triage_consent_given     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS triage_consent_given_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS triage_consent_ip        TEXT;

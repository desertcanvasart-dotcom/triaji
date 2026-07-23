-- Migration 064: Doctor clinic registration intent
-- Doctors can declare, at registration, whether they are independent, own a
-- clinic (provisioned as a tenant on approval), or work at an existing
-- facility already on the platform.

ALTER TABLE doctor_accounts
  ADD COLUMN IF NOT EXISTS clinic_mode                 TEXT NOT NULL DEFAULT 'independent',
  ADD COLUMN IF NOT EXISTS requested_clinic_name_en    TEXT,
  ADD COLUMN IF NOT EXISTS requested_clinic_address_ar TEXT,
  ADD COLUMN IF NOT EXISTS requested_tenant_id         UUID REFERENCES tenants(id);

ALTER TABLE doctor_accounts
  DROP CONSTRAINT IF EXISTS doctor_accounts_clinic_mode_check;

ALTER TABLE doctor_accounts
  ADD CONSTRAINT doctor_accounts_clinic_mode_check
  CHECK (clinic_mode IN ('independent', 'own_clinic', 'existing_clinic'));

CREATE INDEX IF NOT EXISTS idx_doctor_accounts_requested_tenant
  ON doctor_accounts (requested_tenant_id);

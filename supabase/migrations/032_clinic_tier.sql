-- ============================================================
-- Migration 032: Clinic Tenant Type
-- Adds 'clinic' tier, clinic config columns, rooms, new roles
-- ============================================================

-- Add 'clinic' to the tenant tier enum
ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'clinic';

-- Clinic-specific config columns on tenant_config
ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS clinic_specialty_ar     TEXT,
  ADD COLUMN IF NOT EXISTS clinic_specialty_en     TEXT,
  ADD COLUMN IF NOT EXISTS num_doctors             SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS has_walk_in_queue       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS queue_whatsapp_enabled  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS queue_sms_fallback      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS estimated_minutes_per_patient SMALLINT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS opening_time            TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS closing_time            TIME DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS working_days            SMALLINT[] DEFAULT '{0,1,2,3,4,6}',
  ADD COLUMN IF NOT EXISTS clinic_floor_ar         TEXT,
  ADD COLUMN IF NOT EXISTS clinic_phone            TEXT;

-- Rooms/desks within a clinic
CREATE TABLE clinic_rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_ar     TEXT NOT NULL,
  name_en     TEXT,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_rooms_tenant ON clinic_rooms (tenant_id);

ALTER TABLE clinic_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_clinic_rooms" ON clinic_rooms
  FOR ALL USING (auth.role() = 'service_role');

-- Update admin_users role constraint to include clinic roles
ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN (
    'platform_admin',
    'tenant_admin',
    'tenant_manager',
    'clinic_owner',
    'clinic_receptionist',
    'clinic_billing',
    'clinic_doctor'
  ));

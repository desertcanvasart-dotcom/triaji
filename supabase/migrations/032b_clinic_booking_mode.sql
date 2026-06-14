-- ============================================================
-- Migration 032b: Clinic Booking Mode
-- Adds booking mode setting to tenant_config
-- ============================================================

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS clinic_booking_mode TEXT
    NOT NULL DEFAULT 'walk_in_only'
    CHECK (clinic_booking_mode IN (
      'walk_in_only',
      'slots_only',
      'both'
    ));

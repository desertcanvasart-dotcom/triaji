-- ============================================================
-- Migration 046: Add Expo push token to doctor_accounts
-- Enables mobile push notifications for doctors
-- ============================================================

ALTER TABLE doctor_accounts
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

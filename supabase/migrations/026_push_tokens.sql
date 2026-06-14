-- Phase 12: Push notification tokens for mobile app

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

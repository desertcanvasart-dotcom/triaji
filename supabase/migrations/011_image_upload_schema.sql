-- 011_image_upload_schema.sql
-- Add image support columns to session_messages for Phase 6 image upload.
-- Also add patient location columns to triage_sessions for geo-matching.

ALTER TABLE session_messages
  ADD COLUMN IF NOT EXISTS image_urls          TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_analysis_notes TEXT;

ALTER TABLE triage_sessions
  ADD COLUMN IF NOT EXISTS patient_lat FLOAT,
  ADD COLUMN IF NOT EXISTS patient_lng FLOAT;

-- Supabase Storage bucket for session images:
-- Bucket name: session-images
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- Create this in Supabase Dashboard > Storage

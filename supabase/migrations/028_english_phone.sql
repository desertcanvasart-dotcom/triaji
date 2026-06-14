-- 028_english_phone.sql
-- Adds bilingual (Arabic + English) phone call support.
-- When english_enabled is true for a tenant, their phone line uses
-- Deepgram multi-language detection and supports English triage sessions.

-- ─── tenant_config: English language toggle ─────────────────────────────────

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS english_enabled BOOLEAN NOT NULL DEFAULT false;
  -- When true: phone calls support both Arabic and English
  -- When false: phone calls are Arabic-only (existing behaviour)

-- ─── triage_sessions: detected language ─────────────────────────────────────

ALTER TABLE triage_sessions
  ADD COLUMN IF NOT EXISTS detected_lang TEXT NOT NULL DEFAULT 'ar'
    CHECK (detected_lang IN ('ar', 'en'));

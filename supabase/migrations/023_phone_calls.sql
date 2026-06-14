-- Phase 11: Phone Call Center
-- Adds phone number mapping to tenant_config and call fields to triage_sessions

-- Phone number mapping on tenant_config
ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS phone_number         TEXT,
  ADD COLUMN IF NOT EXISTS phone_number_active  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_agent_number   TEXT;

-- Phone call fields on triage_sessions
ALTER TABLE triage_sessions
  ADD COLUMN IF NOT EXISTS call_sid              TEXT,
  ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS recording_url         TEXT,
  ADD COLUMN IF NOT EXISTS transcript_full       TEXT,
  ADD COLUMN IF NOT EXISTS handoff_triggered     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_reason        TEXT;

-- Add 'phone_call' to the session_channel enum type
-- (PostgreSQL enums require ALTER TYPE, not CHECK constraints)
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

-- Indexes for call log queries
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON triage_sessions (channel);
CREATE INDEX IF NOT EXISTS idx_sessions_call_sid ON triage_sessions (call_sid);

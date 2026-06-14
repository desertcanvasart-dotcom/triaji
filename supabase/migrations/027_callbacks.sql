-- 027_callbacks.sql
-- Missed call callback queue for proactive patient re-engagement.
-- When a patient hangs up mid-triage, has no audio, or misses a call,
-- Triaji automatically schedules a callback.

-- ─── Callback status enum ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE callback_status AS ENUM (
    'scheduled',      -- waiting for first attempt
    'attempting',     -- outbound call in progress
    'completed',      -- patient answered and triage completed or declined
    'failed',         -- all attempts exhausted, no answer
    'cancelled',      -- patient called back themselves before callback fired
    'whatsapp_sent'   -- fallback WhatsApp sent after failed calls
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Callback queue table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS callback_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID REFERENCES tenants(id),
  patient_phone       TEXT NOT NULL,
  original_session_id UUID REFERENCES triage_sessions(id),
  trigger_reason      TEXT NOT NULL
    CHECK (trigger_reason IN ('incomplete_session', 'no_audio', 'missed_call')),
  status              callback_status NOT NULL DEFAULT 'scheduled',
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  max_attempts        INTEGER NOT NULL DEFAULT 2,
  scheduled_for       TIMESTAMPTZ NOT NULL,
  last_attempted_at   TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  new_session_id      UUID REFERENCES triage_sessions(id),
  twilio_call_sid     TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_callbacks_status
  ON callback_queue (status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_callbacks_tenant
  ON callback_queue (tenant_id);

CREATE INDEX IF NOT EXISTS idx_callbacks_phone
  ON callback_queue (patient_phone);

CREATE INDEX IF NOT EXISTS idx_callbacks_original_session
  ON callback_queue (original_session_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE callback_queue ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by cron jobs and API routes)
CREATE POLICY "service_role_all" ON callback_queue
  FOR ALL USING (true) WITH CHECK (true);

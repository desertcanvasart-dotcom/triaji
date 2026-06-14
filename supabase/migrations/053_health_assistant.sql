-- ============================================================
-- Migration 053: Arabic Health AI Assistant — تريجي يسألك
-- ============================================================

CREATE TABLE health_assistant_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  lang                  TEXT NOT NULL DEFAULT 'ar',
  messages              JSONB NOT NULL DEFAULT '[]',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count         INTEGER NOT NULL DEFAULT 0,
  escalation_triggered  BOOLEAN NOT NULL DEFAULT false,
  context_snapshot_at   TIMESTAMPTZ,
  flagged_responses     JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assistant_sessions_patient ON health_assistant_sessions (patient_id);
CREATE INDEX idx_assistant_sessions_date    ON health_assistant_sessions (last_message_at DESC);

ALTER TABLE health_assistant_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_assistant" ON health_assistant_sessions FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Migration 051: GP Video Calls — LiveKit Telemedicine
-- ============================================================

CREATE TYPE gp_call_status AS ENUM (
  'initiated', 'ringing', 'accepted', 'declined',
  'missed', 'in_progress', 'completed', 'failed'
);

CREATE TYPE gp_call_initiator AS ENUM ('doctor', 'patient');

CREATE TABLE gp_video_calls (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gp_relationship_id       UUID NOT NULL REFERENCES gp_relationships(id),
  patient_id               UUID NOT NULL REFERENCES patients(id),
  doctor_id                UUID NOT NULL REFERENCES doctors(id),
  doctor_account_id        UUID NOT NULL REFERENCES doctor_accounts(id),
  livekit_room_name        TEXT NOT NULL UNIQUE,
  livekit_room_sid         TEXT,
  initiator                gp_call_initiator NOT NULL,
  status                   gp_call_status NOT NULL DEFAULT 'initiated',
  initiated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at              TIMESTAMPTZ,
  ended_at                 TIMESTAMPTZ,
  duration_seconds         INTEGER,
  is_recorded              BOOLEAN NOT NULL DEFAULT false,
  recording_consent_given  BOOLEAN NOT NULL DEFAULT false,
  recording_url            TEXT,
  recording_expires_at     TIMESTAMPTZ,
  transcription_status     TEXT DEFAULT 'not_started',
  transcription_ar         TEXT,
  transcription_en         TEXT,
  structured_notes_ar      TEXT,
  is_paid                  BOOLEAN NOT NULL DEFAULT false,
  call_fee_egp             DECIMAL(10,2) DEFAULT 0,
  payment_transaction_id   UUID REFERENCES payment_transactions(id),
  post_call_health_record_id UUID REFERENCES health_records(id),
  end_reason               TEXT,
  doctor_connection_quality TEXT,
  patient_connection_quality TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gp_calls_relationship ON gp_video_calls (gp_relationship_id);
CREATE INDEX idx_gp_calls_patient      ON gp_video_calls (patient_id);
CREATE INDEX idx_gp_calls_doctor       ON gp_video_calls (doctor_account_id);
CREATE INDEX idx_gp_calls_status       ON gp_video_calls (status);
CREATE INDEX idx_gp_calls_initiated    ON gp_video_calls (initiated_at DESC);

ALTER TABLE gp_video_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_gp_calls" ON gp_video_calls FOR ALL USING (auth.role() = 'service_role');

-- Doctor video call config
ALTER TABLE doctor_accounts
  ADD COLUMN IF NOT EXISTS gp_video_call_fee_egp     DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gp_video_calls_enabled     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_call_duration_minutes  INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS video_call_availability    JSONB DEFAULT '{}';

-- Link health records to video calls
ALTER TABLE health_records
  ADD COLUMN IF NOT EXISTS gp_video_call_id UUID REFERENCES gp_video_calls(id);

-- Enable Realtime for instant status updates
ALTER PUBLICATION supabase_realtime ADD TABLE gp_video_calls;

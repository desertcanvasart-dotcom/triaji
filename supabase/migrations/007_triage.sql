-- 007_triage.sql

CREATE TYPE session_status  AS ENUM ('active','completed','escalated','abandoned');
CREATE TYPE urgency_level   AS ENUM ('routine','urgent','emergency');
CREATE TYPE session_channel AS ENUM ('app','website_widget','hospital_kiosk','api');

CREATE TABLE triage_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id),
  tenant_id             UUID REFERENCES tenants(id),
  session_start         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end           TIMESTAMPTZ,
  status                session_status NOT NULL DEFAULT 'active',
  chief_complaint_ar    TEXT,
  extracted_symptoms    TEXT[] DEFAULT '{}',
  determined_specialty_id UUID REFERENCES specialties(id),
  specialty_confidence  DECIMAL(3,2),
  urgency_level         urgency_level NOT NULL DEFAULT 'routine',
  emergency_triggered   BOOLEAN NOT NULL DEFAULT false,
  rag_documents_used    UUID[] DEFAULT '{}',
  recommended_doctor_id UUID REFERENCES doctors(id),
  booking_id            UUID,  -- FK added after bookings table
  channel               session_channel NOT NULL DEFAULT 'app'
);

CREATE TABLE session_messages (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL CHECK (role IN ('ai','patient')),
  content_ar            TEXT NOT NULL,
  rag_context_ids       UUID[] DEFAULT '{}',
  emergency_check_result JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_patient  ON triage_sessions (patient_id);
CREATE INDEX idx_sessions_tenant   ON triage_sessions (tenant_id);
CREATE INDEX idx_messages_session  ON session_messages (session_id);

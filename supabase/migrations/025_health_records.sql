-- Phase 12: Health Records — Prescription + Lab Result Tracking

-- Record type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_type') THEN
    CREATE TYPE record_type AS ENUM ('prescription', 'lab_result', 'scan', 'discharge_summary', 'other');
  END IF;
END
$$;

-- Health records table
CREATE TABLE IF NOT EXISTS health_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_id        UUID REFERENCES triage_sessions(id),  -- NULL if uploaded outside triage
  record_type       record_type NOT NULL,
  file_url          TEXT NOT NULL,        -- Supabase Storage path
  file_name         TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- AI-extracted structured data
  analysed          BOOLEAN NOT NULL DEFAULT false,
  analysed_at       TIMESTAMPTZ,

  -- Prescription fields (populated if record_type = 'prescription')
  medications       JSONB DEFAULT '[]',
  prescription_date DATE,
  prescribing_doctor TEXT,

  -- Lab result fields (populated if record_type = 'lab_result')
  lab_values        JSONB DEFAULT '[]',
  lab_date          DATE,
  lab_name          TEXT,

  -- Summary for triage context
  summary_ar        TEXT,
  summary_en        TEXT,

  -- Flags
  has_abnormal_values BOOLEAN NOT NULL DEFAULT false,
  requires_attention  BOOLEAN NOT NULL DEFAULT false,

  -- Soft delete
  deleted_at        TIMESTAMPTZ
);

-- RLS
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY health_records_service ON health_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_records_patient  ON health_records (patient_id);
CREATE INDEX IF NOT EXISTS idx_health_records_type     ON health_records (record_type);
CREATE INDEX IF NOT EXISTS idx_health_records_uploaded ON health_records (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_records_deleted  ON health_records (deleted_at) WHERE deleted_at IS NULL;

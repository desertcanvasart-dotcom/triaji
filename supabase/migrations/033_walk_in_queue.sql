-- ============================================================
-- Migration 033: Walk-In Queue
-- Real-time numbered queue per doctor per day
-- ============================================================

CREATE TYPE queue_entry_source AS ENUM (
  'walk_in',
  'online_booking',
  'phone_booking'
);

CREATE TYPE queue_entry_status AS ENUM (
  'waiting',
  'called',
  'completed',
  'no_show',
  'left',
  'skipped'
);

CREATE TABLE clinic_queue (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doctor_id         UUID NOT NULL REFERENCES doctors(id),
  queue_date        DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Patient info
  patient_id        UUID REFERENCES patients(id),
  patient_name_ar   TEXT NOT NULL,
  patient_phone     TEXT,

  -- Queue position (auto-assigned, resets daily)
  queue_number      INTEGER NOT NULL,

  -- Source and status
  source            queue_entry_source NOT NULL DEFAULT 'walk_in',
  status            queue_entry_status NOT NULL DEFAULT 'waiting',
  booking_id        UUID REFERENCES bookings(id),

  -- Timing
  arrived_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  wait_minutes_actual INTEGER,

  -- Notes
  chief_complaint_ar TEXT,
  internal_notes    TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, doctor_id, queue_date, queue_number)
);

-- Indexes
CREATE INDEX idx_queue_tenant_date   ON clinic_queue (tenant_id, queue_date);
CREATE INDEX idx_queue_doctor_date   ON clinic_queue (doctor_id, queue_date);
CREATE INDEX idx_queue_status        ON clinic_queue (status) WHERE status IN ('waiting', 'called');
CREATE INDEX idx_queue_patient_phone ON clinic_queue (patient_phone);

-- RLS
ALTER TABLE clinic_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_clinic_queue" ON clinic_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Atomic queue number assignment function
CREATE OR REPLACE FUNCTION next_queue_number(
  p_tenant_id UUID,
  p_doctor_id UUID,
  p_date      DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(MAX(queue_number), 0) + 1
  FROM   clinic_queue
  WHERE  tenant_id  = p_tenant_id
    AND  doctor_id  = p_doctor_id
    AND  queue_date = p_date;
$$;

-- Enable Supabase Realtime for live queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE clinic_queue;

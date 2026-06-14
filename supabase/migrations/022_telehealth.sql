-- Migration 022: Telehealth
-- Booking telehealth columns, doctor telehealth capability, consent logging

-- Telehealth appointment type (extend existing bookings)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS appointment_type TEXT NOT NULL DEFAULT 'in_person',
  -- 'in_person' | 'telehealth'
  ADD COLUMN IF NOT EXISTS livekit_room_name TEXT,
  ADD COLUMN IF NOT EXISTS livekit_room_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_ended_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER;

-- Doctor telehealth capability
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS offers_telehealth BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telehealth_fee_egp DECIMAL(10,2);

-- Telehealth session recording consent log
CREATE TABLE telehealth_consents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id   UUID NOT NULL REFERENCES bookings(id),
  patient_id   UUID NOT NULL REFERENCES patients(id),
  consented_to_record BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telehealth_consents_booking ON telehealth_consents (booking_id);

-- 008_bookings.sql

CREATE TYPE booking_status  AS ENUM ('pending','confirmed','cancelled','completed','no_show');
CREATE TYPE booking_source  AS ENUM ('native','his_api');
CREATE TYPE confirm_channel AS ENUM ('whatsapp','sms','both');

CREATE TABLE bookings (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID REFERENCES tenants(id),
  patient_id           UUID NOT NULL REFERENCES patients(id),
  doctor_id            UUID NOT NULL REFERENCES doctors(id),
  session_id           UUID REFERENCES triage_sessions(id),
  slot_id              UUID REFERENCES doctor_availability(id),
  his_booking_ref      TEXT,
  appointment_datetime TIMESTAMPTZ NOT NULL,
  duration_minutes     INTEGER NOT NULL DEFAULT 30,
  status               booking_status NOT NULL DEFAULT 'pending',
  booking_source       booking_source NOT NULL DEFAULT 'native',
  confirmation_sent_at TIMESTAMPTZ,
  confirmation_channel confirm_channel,
  notes_ar             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Back-fill FK on triage_sessions
ALTER TABLE triage_sessions
  ADD CONSTRAINT fk_session_booking
  FOREIGN KEY (booking_id) REFERENCES bookings(id);

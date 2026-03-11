-- 005_doctors.sql

CREATE TABLE doctors (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID REFERENCES tenants(id),  -- NULL = platform-level
  name_ar               TEXT NOT NULL,
  name_en               TEXT,
  title_ar              TEXT DEFAULT 'دكتور',
  specialty_id          UUID NOT NULL REFERENCES specialties(id),
  sub_specialty_ids     UUID[] DEFAULT '{}',
  bio_ar                TEXT,
  photo_url             TEXT,
  languages             TEXT[] DEFAULT '{ar}',
  governorate_id        UUID NOT NULL REFERENCES governorates(id),
  clinic_address_ar     TEXT,
  location              GEOMETRY(Point, 4326),
  consultation_fee_egp  DECIMAL(10,2),
  accepts_insurance     BOOLEAN NOT NULL DEFAULT false,
  insurance_providers   TEXT[] DEFAULT '{}',
  accepting_new_patients BOOLEAN NOT NULL DEFAULT true,
  available_for_booking  BOOLEAN NOT NULL DEFAULT true,
  rating_avg            DECIMAL(3,2) DEFAULT 0,
  rating_count          INTEGER NOT NULL DEFAULT 0,
  his_doctor_id         TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_location    ON doctors USING GIST (location);
CREATE INDEX idx_doctors_specialty   ON doctors (specialty_id);
CREATE INDEX idx_doctors_tenant      ON doctors (tenant_id);
CREATE INDEX idx_doctors_governorate ON doctors (governorate_id);

CREATE TABLE doctor_availability (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id        UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  tenant_id        UUID REFERENCES tenants(id),
  source           TEXT NOT NULL DEFAULT 'native',  -- native|his_sync
  slot_datetime    TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_booked        BOOLEAN NOT NULL DEFAULT false,
  his_slot_id      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_availability_doctor ON doctor_availability (doctor_id);
CREATE INDEX idx_availability_slot   ON doctor_availability (slot_datetime) WHERE NOT is_booked;

CREATE TABLE doctor_ratings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id  UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

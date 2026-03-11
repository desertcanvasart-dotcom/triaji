-- 004_specialties.sql

CREATE TABLE specialties (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  parent_specialty_id UUID REFERENCES specialties(id),
  urgency_default    TEXT NOT NULL DEFAULT 'routine', -- routine|urgent|emergency
  icon_code          TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         INTEGER NOT NULL DEFAULT 0
);

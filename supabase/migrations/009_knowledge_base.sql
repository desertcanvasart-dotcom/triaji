-- 009_knowledge_base.sql

CREATE TYPE kb_collection AS ENUM (
  'conditions','symptoms','specialty_map','emergency_protocols',
  'egypt_context','risk_modifiers','follow_up_questions'
);

CREATE TABLE kb_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id),  -- NULL = platform-wide
  collection  kb_collection NOT NULL,
  title_ar    TEXT NOT NULL,
  title_en    TEXT,
  content_ar  TEXT NOT NULL,
  content_en  TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kb_embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL DEFAULT 0,
  chunk_text      TEXT NOT NULL,
  embedding       VECTOR(1024) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'embed-multilingual-v3',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_kb_embeddings_vector
  ON kb_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE emergency_triggers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description_ar      TEXT NOT NULL,
  symptom_conditions  JSONB NOT NULL,
  profile_conditions  JSONB,
  response_ar         TEXT NOT NULL,
  escalation_type     TEXT NOT NULL, -- emergency_room|call_ambulance|urgent_same_day
  priority            INTEGER NOT NULL DEFAULT 100,
  is_active           BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_emergency_priority ON emergency_triggers (priority) WHERE is_active;

-- RPC function for semantic search
CREATE OR REPLACE FUNCTION match_kb_documents(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count     INT,
  filter_specialties TEXT[] DEFAULT NULL,
  filter_risk_level  TEXT DEFAULT NULL
) RETURNS TABLE (id UUID, content_ar TEXT, similarity FLOAT) AS $$
  SELECT d.id, d.content_ar,
         1 - (e.embedding <=> query_embedding) AS similarity
  FROM   kb_embeddings e
  JOIN   kb_documents d ON d.id = e.document_id
  WHERE  d.is_active = true
    AND  1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER  BY similarity DESC
  LIMIT  match_count;
$$ LANGUAGE sql STABLE;

-- RPC function for doctor geo-matching
CREATE OR REPLACE FUNCTION find_doctors_near(
  p_specialty_id  UUID,
  patient_lat     FLOAT,
  patient_lng     FLOAT,
  radius_km       FLOAT DEFAULT 50,
  p_tenant_id     UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  name_ar TEXT,
  name_en TEXT,
  title_ar TEXT,
  specialty_id UUID,
  bio_ar TEXT,
  photo_url TEXT,
  clinic_address_ar TEXT,
  consultation_fee_egp DECIMAL,
  rating_avg DECIMAL,
  rating_count INTEGER,
  distance_km FLOAT
) AS $$
  SELECT
    d.id, d.name_ar, d.name_en, d.title_ar, d.specialty_id,
    d.bio_ar, d.photo_url, d.clinic_address_ar,
    d.consultation_fee_egp, d.rating_avg, d.rating_count,
    ST_Distance(
      d.location::GEOGRAPHY,
      ST_SetSRID(ST_MakePoint(patient_lng, patient_lat), 4326)::GEOGRAPHY
    ) / 1000 AS distance_km
  FROM   doctors d
  WHERE  d.specialty_id = p_specialty_id
    AND  d.is_active = true
    AND  d.accepting_new_patients = true
    AND  d.available_for_booking = true
    AND  (d.tenant_id = p_tenant_id OR d.tenant_id IS NULL)
    AND  d.location IS NOT NULL
    AND  ST_DWithin(
           d.location::GEOGRAPHY,
           ST_SetSRID(ST_MakePoint(patient_lng, patient_lat), 4326)::GEOGRAPHY,
           radius_km * 1000
         )
  ORDER  BY distance_km ASC
  LIMIT  5;
$$ LANGUAGE sql STABLE;

-- 013_doctor_rpcs.sql
-- PostGIS RPC functions for doctor geo-matching.

-- Drop existing version if any (from Phase 1 009_knowledge_base.sql had find_doctors_near stub)
DROP FUNCTION IF EXISTS find_doctors_near(UUID, FLOAT, FLOAT, FLOAT, UUID, INT);
DROP FUNCTION IF EXISTS find_doctors_by_governorate(UUID, UUID, UUID, INT);

-- ═══════════════════════════════════════════════════════════════════════
-- find_doctors_near — PostGIS proximity search
-- Returns doctors within p_radius_km of a given lat/lng, sorted by distance.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION find_doctors_near(
  p_specialty_id  UUID,
  p_patient_lat   FLOAT,
  p_patient_lng   FLOAT,
  p_radius_km     FLOAT DEFAULT 100,
  p_tenant_id     UUID DEFAULT NULL,
  p_limit         INT  DEFAULT 5
)
RETURNS TABLE (
  id                    UUID,
  name_ar               TEXT,
  title_ar              TEXT,
  specialty_id          UUID,
  specialty_name_ar     TEXT,
  governorate_name_ar   TEXT,
  clinic_address_ar     TEXT,
  consultation_fee_egp  DECIMAL,
  rating_avg            DECIMAL,
  rating_count          INTEGER,
  languages             TEXT[],
  photo_url             TEXT,
  distance_km           FLOAT
) AS $$
  SELECT
    d.id,
    d.name_ar,
    d.title_ar,
    d.specialty_id,
    s.name_ar           AS specialty_name_ar,
    g.name_ar           AS governorate_name_ar,
    d.clinic_address_ar,
    d.consultation_fee_egp,
    d.rating_avg,
    d.rating_count,
    d.languages,
    d.photo_url,
    ROUND((ST_Distance(
      d.location::GEOGRAPHY,
      ST_SetSRID(ST_MakePoint(p_patient_lng, p_patient_lat), 4326)::GEOGRAPHY
    ) / 1000)::DECIMAL, 1)::FLOAT AS distance_km
  FROM   doctors d
  JOIN   specialties s ON s.id = d.specialty_id
  JOIN   governorates g ON g.id = d.governorate_id
  WHERE  d.specialty_id = p_specialty_id
    AND  d.is_active = true
    AND  d.accepting_new_patients = true
    AND  d.available_for_booking = true
    AND  (d.tenant_id = p_tenant_id OR d.tenant_id IS NULL)
    AND  ST_DWithin(
           d.location::GEOGRAPHY,
           ST_SetSRID(ST_MakePoint(p_patient_lng, p_patient_lat), 4326)::GEOGRAPHY,
           p_radius_km * 1000
         )
  ORDER  BY distance_km ASC
  LIMIT  p_limit;
$$ LANGUAGE sql STABLE;

-- ═══════════════════════════════════════════════════════════════════════
-- find_doctors_by_governorate — Fallback when no lat/lng available
-- Returns doctors in a specific governorate, sorted by rating.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION find_doctors_by_governorate(
  p_specialty_id    UUID,
  p_governorate_id  UUID,
  p_tenant_id       UUID DEFAULT NULL,
  p_limit           INT  DEFAULT 5
)
RETURNS TABLE (
  id                    UUID,
  name_ar               TEXT,
  title_ar              TEXT,
  specialty_id          UUID,
  specialty_name_ar     TEXT,
  governorate_name_ar   TEXT,
  clinic_address_ar     TEXT,
  consultation_fee_egp  DECIMAL,
  rating_avg            DECIMAL,
  rating_count          INTEGER,
  languages             TEXT[],
  photo_url             TEXT,
  distance_km           FLOAT
) AS $$
  SELECT
    d.id,
    d.name_ar,
    d.title_ar,
    d.specialty_id,
    s.name_ar   AS specialty_name_ar,
    g.name_ar   AS governorate_name_ar,
    d.clinic_address_ar,
    d.consultation_fee_egp,
    d.rating_avg,
    d.rating_count,
    d.languages,
    d.photo_url,
    0::FLOAT    AS distance_km   -- no precise distance without lat/lng
  FROM   doctors d
  JOIN   specialties s ON s.id = d.specialty_id
  JOIN   governorates g ON g.id = d.governorate_id
  WHERE  d.specialty_id = p_specialty_id
    AND  d.governorate_id = p_governorate_id
    AND  d.is_active = true
    AND  d.accepting_new_patients = true
    AND  d.available_for_booking = true
    AND  (d.tenant_id = p_tenant_id OR d.tenant_id IS NULL)
  ORDER  BY d.rating_avg DESC
  LIMIT  p_limit;
$$ LANGUAGE sql STABLE;

-- Migration 065: doctor_tenants — multi-facility affiliations
--
-- A doctor can now belong to several facilities (e.g. a hospital job plus a
-- private clinic). doctors.tenant_id remains the PRIMARY affiliation so every
-- legacy read keeps working; doctor_tenants is the complete affiliation set.
-- Backfilled from doctors.tenant_id. Matcher RPCs and tenant stats now
-- consider all affiliations.

CREATE TABLE IF NOT EXISTS doctor_tenants (
  doctor_id  UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doctor_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_tenants_tenant ON doctor_tenants (tenant_id);

ALTER TABLE doctor_tenants ENABLE ROW LEVEL SECURITY;

-- Affiliations are public information (shown on clinic pages).
DROP POLICY IF EXISTS doctor_tenants_public_read ON doctor_tenants;
CREATE POLICY doctor_tenants_public_read ON doctor_tenants
  FOR SELECT USING (true);

-- Backfill existing single affiliations as primary
INSERT INTO doctor_tenants (doctor_id, tenant_id, is_primary)
SELECT id, tenant_id, true
FROM   doctors
WHERE  tenant_id IS NOT NULL
ON CONFLICT (doctor_id, tenant_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- Matcher RPCs: a tenant-scoped search now also returns doctors affiliated
-- via doctor_tenants (secondary affiliations), not just the primary one.
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
    AND  (
           d.tenant_id = p_tenant_id
           OR d.tenant_id IS NULL
           OR EXISTS (
             SELECT 1 FROM doctor_tenants dt
             WHERE dt.doctor_id = d.id AND dt.tenant_id = p_tenant_id
           )
         )
    AND  ST_DWithin(
           d.location::GEOGRAPHY,
           ST_SetSRID(ST_MakePoint(p_patient_lng, p_patient_lat), 4326)::GEOGRAPHY,
           p_radius_km * 1000
         )
  ORDER  BY distance_km ASC
  LIMIT  p_limit;
$$ LANGUAGE sql STABLE;

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
    AND  (
           d.tenant_id = p_tenant_id
           OR d.tenant_id IS NULL
           OR EXISTS (
             SELECT 1 FROM doctor_tenants dt
             WHERE dt.doctor_id = d.id AND dt.tenant_id = p_tenant_id
           )
         )
  ORDER  BY d.rating_avg DESC
  LIMIT  p_limit;
$$ LANGUAGE sql STABLE;

-- Tenant list stats: count every affiliated doctor, not just primaries
DROP FUNCTION IF EXISTS tenant_list_stats(UUID[], TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION tenant_list_stats(
  p_tenant_ids     UUID[],
  p_bookings_since TIMESTAMPTZ
)
RETURNS TABLE (
  tenant_id    UUID,
  doctor_count BIGINT,
  bookings_30d BIGINT
) AS $$
  SELECT
    u.tid,
    (SELECT COUNT(DISTINCT d.id) FROM doctors d
      LEFT JOIN doctor_tenants dt ON dt.doctor_id = d.id
      WHERE (d.tenant_id = u.tid OR dt.tenant_id = u.tid) AND d.is_active = true),
    (SELECT COUNT(*) FROM bookings b
      WHERE b.tenant_id = u.tid AND b.created_at >= p_bookings_since)
  FROM unnest(p_tenant_ids) AS u(tid);
$$ LANGUAGE sql STABLE;

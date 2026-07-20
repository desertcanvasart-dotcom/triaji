-- 060_find_labs_near.sql
-- PostGIS proximity search for labs/radiology centers.
--
-- Replaces the app-side haversine sort in GET /api/lab/nearby: distance is
-- computed and sorted in the DB from tenant_config.latitude/longitude (added
-- in 056), so the route no longer fetches every active lab tenant. Tenants
-- without coordinates are still returned (distance_km NULL, sorted last) to
-- match the route's existing behavior. The tenant_config row rides along as
-- JSONB so the function doesn't have to chase that table's column churn.
--
-- Idempotent: safe to run more than once.

DROP FUNCTION IF EXISTS find_labs_near(TEXT[], FLOAT, FLOAT, UUID, INT);

CREATE OR REPLACE FUNCTION find_labs_near(
  p_tiers          TEXT[],
  p_lat            FLOAT DEFAULT NULL,
  p_lng            FLOAT DEFAULT NULL,
  p_governorate_id UUID  DEFAULT NULL,
  p_limit          INT   DEFAULT 50
)
RETURNS TABLE (
  id          UUID,
  name_ar     TEXT,
  name_en     TEXT,
  slug        TEXT,
  tier        TEXT,
  is_active   BOOLEAN,
  config      JSONB,
  distance_km FLOAT
) AS $$
  SELECT
    t.id,
    t.name_ar,
    t.name_en,
    t.slug,
    t.tier::TEXT,
    t.is_active,
    to_jsonb(c) AS config,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
       AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      THEN ROUND((ST_Distance(
             ST_SetSRID(ST_MakePoint(c.longitude::FLOAT, c.latitude::FLOAT), 4326)::GEOGRAPHY,
             ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
           ) / 1000)::DECIMAL, 1)::FLOAT
      ELSE NULL
    END AS distance_km
  FROM   tenants t
  LEFT JOIN tenant_config c ON c.tenant_id = t.id
  WHERE  t.tier::TEXT = ANY(p_tiers)
    AND  t.is_active = true
    AND  (p_governorate_id IS NULL OR c.default_governorate_id = p_governorate_id)
  ORDER  BY distance_km ASC NULLS LAST, t.name_ar ASC
  LIMIT  p_limit;
$$ LANGUAGE sql STABLE;

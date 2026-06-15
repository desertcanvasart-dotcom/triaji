-- 056_tenant_location.sql
-- Provider geo-location + address + ICU coordinator contact.
-- These power the lab/pharmacy "nearby" distance sort and the ICU transfer
-- coordinator contact. They live on tenant_config (per-tenant config), next to
-- the existing default_governorate_id / clinic_phone / opening_time/closing_time
-- /working_days. Distance is computed in app code (haversine) from latitude/longitude.
--
-- Idempotent: safe to run more than once.

ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS latitude              DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS longitude             DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS address_ar            TEXT,
  ADD COLUMN IF NOT EXISTS address_en            TEXT,
  ADD COLUMN IF NOT EXISTS icu_coordinator_phone TEXT;

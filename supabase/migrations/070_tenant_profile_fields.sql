-- 070_tenant_profile_fields.sql
-- Public provider pages (clinic, lab, pharmacy profiles and the lab directory)
-- select a logo, address and phone from `tenants`. None of those columns
-- existed, so the query errored, the lookup returned null and every one of
-- those pages rendered a 404.
--
-- Nullable throughout: existing tenants have none of this yet, and the UI
-- already guards each field (`{tenant.logo_url && …}`).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS logo_url   TEXT,
  ADD COLUMN IF NOT EXISTS address_ar TEXT,
  ADD COLUMN IF NOT EXISTS address_en TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT;

COMMENT ON COLUMN tenants.logo_url   IS 'Public URL of the facility logo shown on its profile page.';
COMMENT ON COLUMN tenants.address_ar IS 'Street address in Arabic, shown on the public profile.';
COMMENT ON COLUMN tenants.address_en IS 'Street address in English, shown on the public profile.';
COMMENT ON COLUMN tenants.phone      IS 'Public contact number for the facility.';

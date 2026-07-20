-- 062_tenant_list_stats.sql
-- Batched per-tenant stats for the platform-admin tenant list.
--
-- GET /api/admin/tenants previously ran 2 count queries PER tenant
-- (active doctors + bookings in the last 30 days) — 2·N round-trips for a
-- list of N tenants. This function returns both counts for all requested
-- tenants in one call. Counts are exact (a row-fetch + JS tally would be
-- capped at PostgREST's max-rows and undercount).
--
-- Idempotent: safe to run more than once.

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
    (SELECT COUNT(*) FROM doctors d
      WHERE d.tenant_id = u.tid AND d.is_active = true),
    (SELECT COUNT(*) FROM bookings b
      WHERE b.tenant_id = u.tid AND b.created_at >= p_bookings_since)
  FROM unnest(p_tenant_ids) AS u(tid);
$$ LANGUAGE sql STABLE;

-- 061_widget_analytics_summary.sql
-- SQL-side aggregation for the admin widget-analytics dashboard.
--
-- GET /api/admin/analytics previously selected every widget_events row for up
-- to 90 days and computed funnel/daily/top-pages counts in JS. widget_events
-- grows one row per impression/click, so that read gets slower (and heavier on
-- memory) as traffic grows. This function returns the pre-aggregated counts
-- as a single JSONB payload.
--
-- Idempotent: safe to run more than once.

DROP FUNCTION IF EXISTS widget_analytics_summary(TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION widget_analytics_summary(
  p_since     TIMESTAMPTZ,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
  WITH filtered AS (
    SELECT event_type, page_url, created_at::date AS day
    FROM   widget_events
    WHERE  created_at >= p_since
      AND  (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  )
  SELECT jsonb_build_object(
    'funnel', (
      SELECT COALESCE(jsonb_object_agg(event_type, cnt), '{}'::jsonb)
      FROM (SELECT event_type, COUNT(*) AS cnt FROM filtered GROUP BY event_type) f
    ),
    'daily', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('date', day, 'event_type', event_type, 'count', cnt) ORDER BY day),
        '[]'::jsonb
      )
      FROM (SELECT day, event_type, COUNT(*) AS cnt FROM filtered GROUP BY day, event_type) d
    ),
    'top_pages', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('url', page_url, 'count', cnt) ORDER BY cnt DESC),
        '[]'::jsonb
      )
      FROM (
        SELECT page_url, COUNT(*) AS cnt
        FROM   filtered
        WHERE  event_type = 'impression' AND page_url IS NOT NULL
        GROUP  BY page_url
        ORDER  BY cnt DESC
        LIMIT  10
      ) p
    ),
    'total_events', (SELECT COUNT(*) FROM filtered)
  );
$$ LANGUAGE sql STABLE;

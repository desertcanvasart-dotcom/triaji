-- ============================================================================
-- Migration 018: Widget Analytics Events
-- Phase 8 — Tracks widget engagement funnel
-- ============================================================================

CREATE TABLE widget_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'impression',        -- widget script loaded on page
                  'button_click',      -- patient clicked the chat button
                  'session_start',     -- patient sent first message
                  'session_complete',  -- specialty determined
                  'booking_started',   -- patient clicked احجز موعد
                  'booking_confirmed'  -- booking created successfully
                )),
  session_id    UUID REFERENCES triage_sessions(id),
  page_url      TEXT,                -- the hospital page where the widget was loaded
  referrer      TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_events_tenant    ON widget_events (tenant_id);
CREATE INDEX idx_widget_events_type      ON widget_events (event_type);
CREATE INDEX idx_widget_events_created   ON widget_events (created_at);

-- RLS: Tenant admins can only see their own tenant's events
ALTER TABLE widget_events ENABLE ROW LEVEL SECURITY;

-- Service role (API routes) can insert events from any tenant
CREATE POLICY widget_events_service_insert ON widget_events
  FOR INSERT
  WITH CHECK (true);

-- Tenant admins can read their own events
CREATE POLICY tenant_own_events ON widget_events
  FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Platform admins (tenant_id IS NULL in admin_users) can see all
CREATE POLICY platform_admin_events ON widget_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND tenant_id IS NULL AND role = 'platform_admin'
    )
  );

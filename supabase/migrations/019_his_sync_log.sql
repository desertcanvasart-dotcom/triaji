-- ============================================================================
-- Migration 019: HIS Sync Logs
-- Phase 9 — Tracks HIS synchronization runs
-- ============================================================================

CREATE TABLE his_sync_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_ended_at   TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'success', 'partial', 'failed')),
  doctors_synced  INTEGER DEFAULT 0,
  slots_added     INTEGER DEFAULT 0,
  slots_removed   INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]',
  triggered_by    TEXT DEFAULT 'cron'
                  CHECK (triggered_by IN ('cron', 'manual', 'webhook'))
);

CREATE INDEX idx_sync_logs_tenant  ON his_sync_logs (tenant_id);
CREATE INDEX idx_sync_logs_started ON his_sync_logs (sync_started_at DESC);

-- RLS
ALTER TABLE his_sync_logs ENABLE ROW LEVEL SECURITY;

-- Service role can insert/update
CREATE POLICY sync_logs_service_all ON his_sync_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tenant admins can read their own
CREATE POLICY sync_logs_tenant_read ON his_sync_logs
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

-- Platform admins can read all
CREATE POLICY sync_logs_platform_read ON his_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND tenant_id IS NULL AND role = 'platform_admin'
    )
  );

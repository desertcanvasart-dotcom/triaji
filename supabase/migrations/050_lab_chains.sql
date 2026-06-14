-- ============================================================
-- Migration 050: Lab Chain Integrations
-- Al-Borg + Al-Mokhtabar + Alfa
-- ============================================================

-- ── Lab Chain Registry ──────────────────────────────────────

CREATE TABLE lab_chains (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT UNIQUE NOT NULL,
  name_ar             TEXT NOT NULL,
  name_en             TEXT NOT NULL,
  logo_url            TEXT,
  website             TEXT,
  hotline             TEXT,
  has_api             BOOLEAN NOT NULL DEFAULT false,
  api_contract_signed BOOLEAN NOT NULL DEFAULT false,
  api_live_date       DATE,
  branch_count        INTEGER,
  governorates_covered TEXT[],
  payment_via_triaji  BOOLEAN NOT NULL DEFAULT true,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0
);

INSERT INTO lab_chains (code, name_ar, name_en, hotline, branch_count, has_api, sort_order) VALUES
  ('alborg', 'معامل الدكتور بصيلة (البرج)', 'Al-Borg Laboratories', '19716', 200, false, 1),
  ('almokhtabar', 'معامل المختبر', 'Al-Mokhtabar Laboratories', '19112', 150, false, 2),
  ('alfa', 'معامل ألفا', 'Alfa Laboratories', '19567', 80, false, 3);

ALTER TABLE lab_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_lab_chains" ON lab_chains FOR SELECT USING (true);
CREATE POLICY "service_role_all_lab_chains" ON lab_chains FOR ALL USING (auth.role() = 'service_role');

-- ── Lab Chain Branches ──────────────────────────────────────

CREATE TABLE lab_chain_branches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_code        TEXT NOT NULL REFERENCES lab_chains(code),
  chain_branch_id   TEXT,
  name_ar           TEXT NOT NULL,
  name_en           TEXT,
  governorate_id    UUID REFERENCES governorates(id),
  address_ar        TEXT NOT NULL,
  phone             TEXT,
  location          GEOMETRY(POINT, 4326),
  opening_time      TIME,
  closing_time      TIME,
  working_days      INTEGER[],
  accepts_walk_ins  BOOLEAN NOT NULL DEFAULT true,
  home_collection   BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_chain_branches_code     ON lab_chain_branches (chain_code);
CREATE INDEX idx_chain_branches_location ON lab_chain_branches USING GIST (location);

ALTER TABLE lab_chain_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_branches" ON lab_chain_branches FOR SELECT USING (true);
CREATE POLICY "service_role_all_branches" ON lab_chain_branches FOR ALL USING (auth.role() = 'service_role');

-- ── Test Code Mapping ───────────────────────────────────────

CREATE TABLE lab_chain_test_mapping (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_code        TEXT NOT NULL REFERENCES lab_chains(code),
  triaji_code       TEXT NOT NULL,
  chain_test_code   TEXT NOT NULL,
  chain_test_name_ar TEXT,
  chain_price_egp   DECIMAL(10,2),
  is_available      BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (chain_code, triaji_code)
);

CREATE INDEX idx_test_mapping_chain  ON lab_chain_test_mapping (chain_code);
CREATE INDEX idx_test_mapping_triaji ON lab_chain_test_mapping (triaji_code);

ALTER TABLE lab_chain_test_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_test_mapping" ON lab_chain_test_mapping FOR ALL USING (auth.role() = 'service_role');

-- ── Chain Order Tracking on lab_order_routing ────────────────

ALTER TABLE lab_order_routing
  ADD COLUMN IF NOT EXISTS chain_code            TEXT REFERENCES lab_chains(code),
  ADD COLUMN IF NOT EXISTS chain_order_id        TEXT,
  ADD COLUMN IF NOT EXISTS chain_branch_id       TEXT,
  ADD COLUMN IF NOT EXISTS chain_branch_name_ar  TEXT,
  ADD COLUMN IF NOT EXISTS api_submission_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS api_error_count        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_api_error         TEXT,
  ADD COLUMN IF NOT EXISTS manual_fallback_active BOOLEAN DEFAULT false;

-- ── Chain Webhook Log ───────────────────────────────────────

CREATE TABLE lab_chain_webhooks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_code   TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  signature    TEXT,
  is_verified  BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  routing_id   UUID REFERENCES lab_order_routing(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chain_webhooks_chain   ON lab_chain_webhooks (chain_code);
CREATE INDEX idx_chain_webhooks_routing ON lab_chain_webhooks (routing_id);

ALTER TABLE lab_chain_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_chain_webhooks" ON lab_chain_webhooks FOR ALL USING (auth.role() = 'service_role');

-- ── Chain Sync Log (amendment 4) ────────────────────────────

CREATE TABLE lab_chain_sync_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_code    TEXT NOT NULL,
  sync_type     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'started',
  items_synced  INTEGER DEFAULT 0,
  error         TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_sync_log_chain ON lab_chain_sync_log (chain_code);

-- ── Nearest Branch RPC ──────────────────────────────────────

CREATE OR REPLACE FUNCTION find_nearest_chain_branches(
  p_chain_code TEXT,
  p_lat        FLOAT,
  p_lng        FLOAT,
  p_radius_km  FLOAT DEFAULT 20
) RETURNS TABLE (
  branch_id       UUID,
  name_ar         TEXT,
  name_en         TEXT,
  address_ar      TEXT,
  phone           TEXT,
  distance_km     FLOAT,
  opening_time    TIME,
  closing_time    TIME,
  home_collection BOOLEAN
) AS $$
  SELECT
    b.id,
    b.name_ar,
    b.name_en,
    b.address_ar,
    b.phone,
    ST_Distance(
      b.location::GEOGRAPHY,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
    ) / 1000 AS distance_km,
    b.opening_time,
    b.closing_time,
    b.home_collection
  FROM lab_chain_branches b
  WHERE b.chain_code = p_chain_code
    AND b.is_active = true
    AND ST_DWithin(
      b.location::GEOGRAPHY,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
      p_radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 10;
$$ LANGUAGE sql STABLE;

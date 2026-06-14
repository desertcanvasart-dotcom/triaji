-- ============================================================
-- Migration 045: ICU Bed Availability System
-- Real-time ICU vacancy tracking + emergency transfer
-- ============================================================

-- ── ICU Enums ───────────────────────────────────────────────

CREATE TYPE icu_unit_type AS ENUM (
  'general_icu',
  'cardiac_icu',
  'neonatal_icu',
  'paediatric_icu',
  'surgical_icu',
  'neurological_icu',
  'burns_icu',
  'respiratory_icu'
);

CREATE TYPE icu_update_source AS ENUM (
  'manual',
  'his_sync'
);

CREATE TYPE transfer_status AS ENUM (
  'requested',
  'acknowledged',
  'accepted',
  'declined',
  'en_route',
  'arrived',
  'cancelled'
);

-- ── ICU Units Registry ──────────────────────────────────────

CREATE TABLE icu_units (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  unit_type         icu_unit_type NOT NULL,
  unit_name_ar      TEXT NOT NULL,
  unit_name_en      TEXT,

  -- Capacity
  total_beds        INTEGER NOT NULL CHECK (total_beds > 0),
  available_beds    INTEGER NOT NULL DEFAULT 0
    CHECK (available_beds >= 0),
  occupied_beds     INTEGER GENERATED ALWAYS AS
    (total_beds - available_beds) STORED,

  -- Unit details
  floor_ar          TEXT,
  floor_en          TEXT,
  phone_direct      TEXT,
  accepts_transfers BOOLEAN NOT NULL DEFAULT true,

  -- HIS sync
  his_unit_id       TEXT,
  last_his_sync_at  TIMESTAMPTZ,
  update_source     icu_update_source NOT NULL DEFAULT 'manual',

  -- Status
  is_active         BOOLEAN NOT NULL DEFAULT true,
  closure_reason_ar TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, unit_type, unit_name_ar)
);

CREATE INDEX idx_icu_units_tenant    ON icu_units (tenant_id);
CREATE INDEX idx_icu_units_type      ON icu_units (unit_type);
CREATE INDEX idx_icu_units_available ON icu_units (available_beds)
  WHERE is_active = true AND accepts_transfers = true;

ALTER TABLE icu_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_icu_units" ON icu_units
  FOR ALL USING (auth.role() = 'service_role');

-- Hospital staff can manage their own units
CREATE POLICY "hospital_own_icu" ON icu_units
  FOR ALL USING (tenant_id = (
    SELECT tenant_id FROM admin_users WHERE id = auth.uid()
  ));

-- Verified doctors can READ all active units (cross-tenant)
CREATE POLICY "doctors_read_icu" ON icu_units
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM doctor_accounts WHERE id = auth.uid()
    )
  );

-- ── ICU Availability Log ────────────────────────────────────

CREATE TABLE icu_availability_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icu_unit_id         UUID NOT NULL REFERENCES icu_units(id),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),

  previous_available  INTEGER NOT NULL,
  new_available       INTEGER NOT NULL,
  change_reason       TEXT,
  -- 'patient_admitted' | 'patient_discharged' | 'patient_transferred_out'
  -- | 'bed_maintenance' | 'his_sync' | 'manual_correction'

  updated_by          UUID REFERENCES admin_users(id),
  transfer_request_id UUID,  -- FK added after transfer_requests table

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_icu_log_unit   ON icu_availability_log (icu_unit_id);
CREATE INDEX idx_icu_log_tenant ON icu_availability_log (tenant_id);
CREATE INDEX idx_icu_log_time   ON icu_availability_log (created_at DESC);

ALTER TABLE icu_availability_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_icu_log" ON icu_availability_log
  FOR ALL USING (auth.role() = 'service_role');

-- ── ICU Transfer Requests ───────────────────────────────────

CREATE TABLE icu_transfer_requests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Requesting doctor
  requesting_doctor_id  UUID NOT NULL REFERENCES doctors(id),
  requesting_account_id UUID NOT NULL REFERENCES doctor_accounts(id),
  requesting_tenant_id  UUID REFERENCES tenants(id),

  -- Receiving hospital
  receiving_tenant_id   UUID NOT NULL REFERENCES tenants(id),
  icu_unit_id           UUID NOT NULL REFERENCES icu_units(id),

  -- Patient (may not be registered on Triaji)
  patient_id            UUID REFERENCES patients(id),
  patient_name_ar       TEXT NOT NULL,
  patient_age           INTEGER,
  patient_sex           TEXT,
  patient_phone         TEXT,

  -- Clinical summary
  diagnosis_ar          TEXT NOT NULL,
  clinical_summary_ar   TEXT NOT NULL,
  urgency               TEXT NOT NULL DEFAULT 'urgent',

  -- Location
  current_location_ar   TEXT NOT NULL,
  current_location_lat  FLOAT,
  current_location_lng  FLOAT,
  estimated_eta_minutes INTEGER,

  -- Status flow
  status                transfer_status NOT NULL DEFAULT 'requested',
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at       TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  decline_reason_ar     TEXT,
  en_route_at           TIMESTAMPTZ,
  arrived_at            TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,

  -- Receiving hospital response
  accepted_by           UUID REFERENCES admin_users(id),
  bed_assigned_ar       TEXT,
  receiving_contact_phone TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK back to availability log
ALTER TABLE icu_availability_log
  ADD CONSTRAINT fk_transfer_request
  FOREIGN KEY (transfer_request_id)
  REFERENCES icu_transfer_requests(id);

CREATE INDEX idx_transfer_requesting ON icu_transfer_requests (requesting_account_id);
CREATE INDEX idx_transfer_receiving  ON icu_transfer_requests (receiving_tenant_id);
CREATE INDEX idx_transfer_unit       ON icu_transfer_requests (icu_unit_id);
CREATE INDEX idx_transfer_status     ON icu_transfer_requests (status);

ALTER TABLE icu_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_transfers" ON icu_transfer_requests
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "doctor_own_transfers" ON icu_transfer_requests
  FOR SELECT USING (requesting_account_id = auth.uid());
CREATE POLICY "hospital_incoming_transfers" ON icu_transfer_requests
  FOR ALL USING (receiving_tenant_id = (
    SELECT tenant_id FROM admin_users WHERE id = auth.uid()
  ));

-- ── Enable Realtime ─────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE icu_units;
ALTER PUBLICATION supabase_realtime ADD TABLE icu_transfer_requests;

-- ── Add icu_coordinator role ────────────────────────────────

ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN (
    'platform_admin',
    'tenant_admin', 'tenant_manager',
    'clinic_owner', 'clinic_receptionist', 'clinic_billing', 'clinic_doctor',
    'lab_owner', 'lab_receptionist', 'lab_technician', 'lab_billing',
    'pharmacy_owner', 'pharmacy_staff', 'pharmacy_billing',
    'insurance_admin', 'insurance_reviewer', 'insurance_finance',
    'icu_coordinator'
  ));

-- ── Geospatial Search RPC ───────────────────────────────────

CREATE OR REPLACE FUNCTION find_icu_beds_near(
  p_lat           FLOAT,
  p_lng           FLOAT,
  p_unit_type     icu_unit_type DEFAULT NULL,
  p_radius_km     FLOAT DEFAULT 50,
  p_min_beds      INTEGER DEFAULT 0
) RETURNS TABLE (
  icu_unit_id       UUID,
  tenant_id         UUID,
  hospital_name_ar  TEXT,
  hospital_name_en  TEXT,
  unit_type         icu_unit_type,
  unit_name_ar      TEXT,
  unit_name_en      TEXT,
  available_beds    INTEGER,
  total_beds        INTEGER,
  floor_ar          TEXT,
  phone_direct      TEXT,
  accepts_transfers BOOLEAN,
  distance_km       FLOAT,
  last_updated_at   TIMESTAMPTZ,
  location          GEOMETRY
) AS $$
  SELECT
    u.id,
    u.tenant_id,
    t.name_ar,
    t.name_en,
    u.unit_type,
    u.unit_name_ar,
    u.unit_name_en,
    u.available_beds,
    u.total_beds,
    u.floor_ar,
    u.phone_direct,
    u.accepts_transfers,
    ST_Distance(
      g.centroid::GEOGRAPHY,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
    ) / 1000 AS distance_km,
    u.updated_at,
    g.centroid
  FROM icu_units u
  JOIN tenants t ON t.id = u.tenant_id
  JOIN tenant_config tc ON tc.tenant_id = u.tenant_id
  JOIN governorates g ON g.id = tc.default_governorate_id
  WHERE u.is_active = true
    AND u.available_beds >= p_min_beds
    AND (p_unit_type IS NULL OR u.unit_type = p_unit_type)
    AND g.centroid IS NOT NULL
    AND ST_DWithin(
      g.centroid::GEOGRAPHY,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
      p_radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 20;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

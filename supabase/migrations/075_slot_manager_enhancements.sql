-- Migration 075: slot manager enhancements — visit types, schedule templates,
-- and per-doctor booking policy.
--
-- All three are additive and optional; a doctor with none of them behaves
-- exactly as before. Times follow the floating clinic-local (naive `Z`)
-- convention used by doctor_availability / doctor_time_off.
--
--   * doctor_visit_types      — a catalogue of appointment kinds per doctor
--                               (New consultation 30m, Follow-up 15m, …); a
--                               slot may point at one to inherit its duration.
--   * doctor_schedule_templates — a saved weekly pattern ("Sun & Tue 16–19")
--                               that the weekly-schedule generator can re-apply.
--   * doctor_booking_policy   — lead time, booking horizon, default duration and
--                               inter-slot buffer, enforced when slots are made.

-- ── Visit types ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_visit_types (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id        UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  tenant_id        UUID REFERENCES tenants(id),
  name             TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_types_doctor ON doctor_visit_types (doctor_id);

-- A slot can reference the visit type it was created for (kept on delete).
ALTER TABLE doctor_availability
  ADD COLUMN IF NOT EXISTS visit_type_id UUID REFERENCES doctor_visit_types(id) ON DELETE SET NULL;

-- ── Schedule templates ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_schedule_templates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id        UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  tenant_id        UUID REFERENCES tenants(id),
  name             TEXT NOT NULL,
  days_of_week     SMALLINT[] NOT NULL,          -- 0=Sun … 6=Sat
  times            TEXT[] NOT NULL,              -- 'HH:MM' clinic-local
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_doctor ON doctor_schedule_templates (doctor_id);

-- ── Booking policy (one row per doctor) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_booking_policy (
  doctor_id            UUID PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
  tenant_id            UUID REFERENCES tenants(id),
  min_notice_minutes   INTEGER NOT NULL DEFAULT 0   CHECK (min_notice_minutes >= 0),
  max_advance_days     INTEGER NOT NULL DEFAULT 60  CHECK (max_advance_days > 0),
  default_duration_min INTEGER NOT NULL DEFAULT 30  CHECK (default_duration_min > 0),
  buffer_minutes       INTEGER NOT NULL DEFAULT 0   CHECK (buffer_minutes >= 0),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS: mirror doctor_availability (service-role writes, tenant-scoped read) ─
ALTER TABLE doctor_visit_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_booking_policy     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON doctor_visit_types;
CREATE POLICY service_role_all ON doctor_visit_types
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS visit_types_tenant_read ON doctor_visit_types;
CREATE POLICY visit_types_tenant_read ON doctor_visit_types
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID OR tenant_id IS NULL
  );

DROP POLICY IF EXISTS service_role_all ON doctor_schedule_templates;
CREATE POLICY service_role_all ON doctor_schedule_templates
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS schedule_templates_tenant_read ON doctor_schedule_templates;
CREATE POLICY schedule_templates_tenant_read ON doctor_schedule_templates
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID OR tenant_id IS NULL
  );

DROP POLICY IF EXISTS service_role_all ON doctor_booking_policy;
CREATE POLICY service_role_all ON doctor_booking_policy
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS booking_policy_tenant_read ON doctor_booking_policy;
CREATE POLICY booking_policy_tenant_read ON doctor_booking_policy
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID OR tenant_id IS NULL
  );

-- Migration 074: doctor_time_off — availability exceptions (days off / time off)
--
-- The availability manager materialises concrete slots, but had no way to say
-- "the doctor is away" without deleting each slot by hand. doctor_time_off is a
-- lightweight overlay of blocked intervals (a holiday, a vacation span, or an
-- afternoon off). Slot creation refuses to place a slot inside a block, the
-- calendar renders blocked days distinctly, and booked slots that fall inside a
-- new block are surfaced as conflicts (never silently dropped).
--
-- Interval convention matches doctor_availability.slot_datetime: a *floating*
-- clinic-local wall clock stored with a `Z` label. A full day off for D is
-- [D 00:00, D+1 00:00); a partial block is [D from, D to).

CREATE TABLE IF NOT EXISTS doctor_time_off (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id  UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  tenant_id  UUID REFERENCES tenants(id),
  starts_at  TIMESTAMPTZ NOT NULL,          -- inclusive
  ends_at    TIMESTAMPTZ NOT NULL,          -- exclusive
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_time_off_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_time_off_doctor ON doctor_time_off (doctor_id, starts_at);

ALTER TABLE doctor_time_off ENABLE ROW LEVEL SECURITY;

-- Mirror doctor_availability: full access for the service role (all server-side
-- admin writes go through it), tenant-scoped reads otherwise.
DROP POLICY IF EXISTS service_role_all ON doctor_time_off;
CREATE POLICY service_role_all ON doctor_time_off
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS time_off_tenant_isolation ON doctor_time_off;
CREATE POLICY time_off_tenant_isolation ON doctor_time_off
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID
    OR tenant_id IS NULL
  );

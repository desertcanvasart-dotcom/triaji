-- ============================================================
-- Migration 036: Lab Order Routing + Appointments + Lab Roles
-- Digital order-to-result pipeline
-- ============================================================

-- Order status lifecycle
CREATE TYPE lab_order_status AS ENUM (
  'ordered',
  'routed',
  'received',
  'sample_collected',
  'processing',
  'results_ready',
  'delivered',
  'cancelled'
);

-- Lab appointment status
CREATE TYPE lab_appointment_status AS ENUM (
  'scheduled',
  'checked_in',
  'sample_taken',
  'completed',
  'no_show',
  'cancelled'
);

-- ============================================================
-- LAB ORDER ROUTING
-- Links doctor orders to specific labs
-- ============================================================

CREATE TABLE lab_order_routing (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  health_record_id    UUID NOT NULL REFERENCES health_records(id),
  lab_tenant_id       UUID NOT NULL REFERENCES tenants(id),
  doctor_id           UUID NOT NULL REFERENCES doctors(id),
  doctor_account_id   UUID REFERENCES doctor_accounts(id),
  patient_id          UUID NOT NULL REFERENCES patients(id),

  is_urgent           BOOLEAN NOT NULL DEFAULT false,
  status              lab_order_status NOT NULL DEFAULT 'ordered',

  routed_at           TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,
  sample_collected_at TIMESTAMPTZ,
  results_ready_at    TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,

  lab_appointment_id  UUID,  -- FK added after lab_appointments table
  result_health_record_id UUID REFERENCES health_records(id),

  routing_note_ar     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_routing_lab      ON lab_order_routing (lab_tenant_id);
CREATE INDEX idx_lab_routing_doctor   ON lab_order_routing (doctor_id);
CREATE INDEX idx_lab_routing_patient  ON lab_order_routing (patient_id);
CREATE INDEX idx_lab_routing_status   ON lab_order_routing (status);

ALTER TABLE lab_order_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_lab_order_routing" ON lab_order_routing
  FOR ALL USING (auth.role() = 'service_role');

-- Enable Realtime for lab order updates
ALTER PUBLICATION supabase_realtime ADD TABLE lab_order_routing;

-- ============================================================
-- LAB APPOINTMENTS
-- ============================================================

CREATE TABLE lab_appointments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lab_tenant_id         UUID NOT NULL REFERENCES tenants(id),
  patient_id            UUID REFERENCES patients(id),
  patient_name_ar       TEXT NOT NULL,
  patient_phone         TEXT,
  lab_order_routing_id  UUID REFERENCES lab_order_routing(id),

  appointment_datetime  TIMESTAMPTZ,
  is_walk_in            BOOLEAN NOT NULL DEFAULT false,
  is_home_collection    BOOLEAN NOT NULL DEFAULT false,
  collection_address_ar TEXT,

  status                lab_appointment_status NOT NULL DEFAULT 'scheduled',
  checked_in_at         TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,

  notes_ar              TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_appt_tenant  ON lab_appointments (lab_tenant_id);
CREATE INDEX idx_lab_appt_patient ON lab_appointments (patient_id);
CREATE INDEX idx_lab_appt_routing ON lab_appointments (lab_order_routing_id);

ALTER TABLE lab_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_lab_appointments" ON lab_appointments
  FOR ALL USING (auth.role() = 'service_role');

-- Add FK back to lab_order_routing
ALTER TABLE lab_order_routing
  ADD CONSTRAINT fk_lab_appointment
  FOREIGN KEY (lab_appointment_id) REFERENCES lab_appointments(id);

-- ============================================================
-- LAB ROLES (extend admin_users)
-- ============================================================

ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN (
    'platform_admin',
    'tenant_admin',
    'tenant_manager',
    'clinic_owner',
    'clinic_receptionist',
    'clinic_billing',
    'clinic_doctor',
    'lab_owner',
    'lab_receptionist',
    'lab_technician',
    'lab_billing'
  ));

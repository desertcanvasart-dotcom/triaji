-- 010_rls.sql — Row Level Security
-- Enable RLS on all tenant-scoped tables

ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_integrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_ratings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_embeddings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_triggers  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Service role bypass — allows API routes using service_role key
-- to access all data regardless of RLS
-- ============================================================

-- Tenants
CREATE POLICY service_role_all ON tenants
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY tenant_read_own ON tenants
  FOR SELECT USING (id = (current_setting('app.current_tenant_id', true))::UUID);

-- Tenant Config
CREATE POLICY service_role_all ON tenant_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY tenant_config_isolation ON tenant_config
  FOR SELECT USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

-- HIS Integrations
CREATE POLICY service_role_all ON his_integrations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY his_tenant_isolation ON his_integrations
  FOR SELECT USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

-- Doctors
CREATE POLICY service_role_all ON doctors
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY doctors_tenant_isolation ON doctors
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID
    OR tenant_id IS NULL  -- platform-level doctors visible to all
  );

-- Doctor Availability
CREATE POLICY service_role_all ON doctor_availability
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY availability_tenant_isolation ON doctor_availability
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID
    OR tenant_id IS NULL
  );

-- Doctor Ratings
CREATE POLICY service_role_all ON doctor_ratings
  FOR ALL USING (auth.role() = 'service_role');

-- Patients
CREATE POLICY service_role_all ON patients
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY patients_tenant_isolation ON patients
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID
    OR tenant_id IS NULL
  );

-- Patient Profiles
CREATE POLICY service_role_all ON patient_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY profiles_via_patient ON patient_profiles
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients
      WHERE tenant_id = (current_setting('app.current_tenant_id', true))::UUID
        OR tenant_id IS NULL
    )
  );

-- Triage Sessions
CREATE POLICY service_role_all ON triage_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY sessions_tenant_isolation ON triage_sessions
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID
    OR tenant_id IS NULL
  );

-- Session Messages
CREATE POLICY service_role_all ON session_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY messages_via_session ON session_messages
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM triage_sessions
      WHERE tenant_id = (current_setting('app.current_tenant_id', true))::UUID
        OR tenant_id IS NULL
    )
  );

-- Bookings
CREATE POLICY service_role_all ON bookings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY bookings_tenant_isolation ON bookings
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID
    OR tenant_id IS NULL
  );

-- KB Documents
CREATE POLICY service_role_all ON kb_documents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY kb_platform_and_tenant ON kb_documents
  FOR SELECT USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::UUID
    OR tenant_id IS NULL  -- platform-wide KB visible to all
  );

-- KB Embeddings
CREATE POLICY service_role_all ON kb_embeddings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY kb_embeddings_via_doc ON kb_embeddings
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM kb_documents
      WHERE tenant_id = (current_setting('app.current_tenant_id', true))::UUID
        OR tenant_id IS NULL
    )
  );

-- Emergency Triggers (platform-wide, read by all)
CREATE POLICY service_role_all ON emergency_triggers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY emergency_triggers_read_all ON emergency_triggers
  FOR SELECT USING (true);  -- All tenants can read emergency triggers

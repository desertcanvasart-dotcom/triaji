-- 058_rls_hardening.sql
-- Fixes two RLS problems found during the 2026-06-16 key-rotation review.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1) PII EXPOSURE to the anon/publishable key
-- ─────────────────────────────────────────────────────────────────────────────
-- patients / triage_sessions / session_messages / bookings had SELECT policies
-- that allowed `OR tenant_id IS NULL` (intended for "platform-level public rows").
-- In practice these rows are ALL created with tenant_id = NULL, so the publishable
-- key (which ships in the browser) could read them:
--   patients         52 rows (names, phone numbers)
--   triage_sessions  51 rows (chief complaints, transcripts)
--   session_messages 74 rows (triage chat content)
-- Every legitimate read of these tables is server-side via the service-role key
-- (which bypasses RLS via the existing `service_role_all` policies); no client code
-- reads them with the anon key. So the anon-facing SELECT policies are dropped →
-- non-service roles get default-deny. `patient_profiles` gets the same treatment
-- for defense-in-depth (same risky subquery pattern, though not currently leaking).
--
-- NOTE: reference/catalog/KB/doctor-directory tables (doctors, doctor_availability,
-- specialties, *_catalog, *_options, kb_documents, emergency_triggers, etc.) are
-- INTENTIONALLY anon-readable for the public triage widget + booking and are left
-- untouched.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 2) admin_users INFINITE RECURSION (Postgres 42P17)
-- ─────────────────────────────────────────────────────────────────────────────
-- Both policies on admin_users query admin_users from within a policy ON
-- admin_users (self-reference) → infinite recursion for any non-service-role
-- access. Admin auth reads this table via the service role (BYPASSRLS), so the
-- self-referential policies are removed and replaced by a service-role policy.
--
-- Idempotent: safe to run more than once.

-- ── 1) Lock down PII tables to service-role-only (default-deny for anon) ───────
DROP POLICY IF EXISTS patients_tenant_isolation ON patients;
DROP POLICY IF EXISTS profiles_via_patient      ON patient_profiles;
DROP POLICY IF EXISTS sessions_tenant_isolation ON triage_sessions;
DROP POLICY IF EXISTS messages_via_session      ON session_messages;
DROP POLICY IF EXISTS bookings_tenant_isolation ON bookings;
-- (service_role_all on each of these already exists from 010_rls.sql)

-- ── 2) Fix admin_users recursion ──────────────────────────────────────────────
DROP POLICY IF EXISTS platform_admin_all ON admin_users;
DROP POLICY IF EXISTS tenant_admin_own   ON admin_users;
DROP POLICY IF EXISTS service_role_all    ON admin_users;
CREATE POLICY service_role_all ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

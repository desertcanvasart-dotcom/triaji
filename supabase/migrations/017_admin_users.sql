-- Migration 017: Admin Users
-- Phase 7 — Admin panel authentication

CREATE TABLE admin_users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    UUID REFERENCES tenants(id),  -- NULL = platform admin
  role         TEXT NOT NULL CHECK (role IN ('platform_admin', 'tenant_admin', 'tenant_manager')),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Platform admins see all admin users
CREATE POLICY platform_admin_all ON admin_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid() AND au.role = 'platform_admin'
    )
  );

-- Tenant admins see only their own tenant's users
CREATE POLICY tenant_admin_own ON admin_users
  FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM admin_users WHERE id = auth.uid()
  ));

-- Index for fast lookups
CREATE INDEX idx_admin_users_tenant ON admin_users(tenant_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_email ON admin_users(email);

/*
  MANUAL SETUP REQUIRED:

  1. Create a user in Supabase Auth dashboard (Authentication → Users → Add User)
     Use your email + a secure password.

  2. Copy the user's UUID from the Auth dashboard.

  3. Run this SQL in the Supabase SQL Editor (replace values):

     INSERT INTO admin_users (id, tenant_id, role, name, email)
     VALUES (
       'YOUR-AUTH-USER-UUID',
       NULL,  -- NULL = platform admin (no tenant scope)
       'platform_admin',
       'Islam Hussein',
       'your-email@example.com'
     );

  4. Set PLATFORM_ADMIN_SECRET in .env.local for any API-level admin verification.
*/

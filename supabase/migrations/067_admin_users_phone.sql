-- 067_admin_users_phone.sql
-- Adds a contact mobile to admin users so the admin panel's password reset can
-- send a WhatsApp/SMS OTP. Nullable: existing admins have no number on file and
-- fall back to the email recovery link until one is set.

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN admin_users.phone IS
  'Egyptian mobile (local format, e.g. 01012345678) used for password-reset OTPs. NULL = reset falls back to email.';

-- 073_tenant_config_unique_tenant_id.sql
-- tenant_config holds one row per tenant, but nothing enforced it: there was no
-- unique constraint on tenant_id. So every writer that wants "one row per
-- tenant" had to update-then-insert (clinic/settings, clinic/payment-settings)
-- or attempt an upsert that could never key on tenant_id
-- (chain/[id]/branches used onConflict:'tenant_id', which silently failed).
--
-- Add the missing constraint so a plain upsert(onConflict:'tenant_id') works and
-- a duplicate-row race becomes impossible. The live table has no duplicate or
-- null tenant_id today, so the constraint applies cleanly; if a future
-- environment does hold duplicates this migration will (correctly) fail until
-- they are resolved.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'tenant_config'::regclass
      AND conname = 'tenant_config_tenant_id_key'
  ) THEN
    ALTER TABLE tenant_config
      ADD CONSTRAINT tenant_config_tenant_id_key UNIQUE (tenant_id);
  END IF;
END $$;

COMMENT ON CONSTRAINT tenant_config_tenant_id_key ON tenant_config
  IS 'One config row per tenant; lets writers upsert on tenant_id.';

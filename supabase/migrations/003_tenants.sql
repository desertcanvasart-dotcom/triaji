-- 003_tenants.sql

CREATE TYPE tenant_tier AS ENUM ('platform', 'basic', 'premium');

CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  tier        tenant_tier NOT NULL DEFAULT 'basic',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_config (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url             TEXT,
  primary_color        TEXT DEFAULT '0D7A7A',
  welcome_message_ar   TEXT,
  sms_sender_name      TEXT,
  whatsapp_number      TEXT,
  booking_mode         TEXT NOT NULL DEFAULT 'native', -- native|his_integration|hybrid
  default_governorate_id UUID REFERENCES governorates(id),
  widget_domains       TEXT[] DEFAULT '{}',
  UNIQUE (tenant_id)
);

CREATE TABLE his_integrations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor                TEXT NOT NULL,  -- shifa|neuron|custom
  base_url              TEXT NOT NULL,
  auth_type             TEXT NOT NULL,  -- api_key|oauth2|basic
  credentials_encrypted JSONB NOT NULL DEFAULT '{}',
  sync_enabled          BOOLEAN NOT NULL DEFAULT false,
  last_sync_at          TIMESTAMPTZ,
  adapter_version       TEXT NOT NULL DEFAULT 'v1',
  UNIQUE (tenant_id)
);

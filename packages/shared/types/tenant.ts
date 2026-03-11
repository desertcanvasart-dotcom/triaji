import type { TenantTier, HisVendor, HisAuthType } from './enums';

// ─── Governorate ─────────────────────────────────────────────────────────────

export type GovernorateRegion =
  | 'cairo_metro'
  | 'delta'
  | 'upper_egypt'
  | 'canal'
  | 'sinai'
  | 'border';

export interface Governorate {
  id: string;
  name_ar: string;
  name_en: string;
  region: GovernorateRegion;
  code: string;
}

// ─── Tenant ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  tier: TenantTier;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Tenant Config ───────────────────────────────────────────────────────────

export interface TenantConfig {
  id: string;
  tenant_id: string;
  max_sessions_per_day: number;
  allowed_channels: string[];
  default_governorate_id: string | null;
  booking_enabled: boolean;
  his_enabled: boolean;
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  custom_prompts: Record<string, string>;
  feature_flags: Record<string, boolean>;
  updated_at: string;
}

// ─── HIS Integration ────────────────────────────────────────────────────────

export interface HisIntegration {
  id: string;
  tenant_id: string;
  vendor: HisVendor;
  base_url: string;
  auth_type: HisAuthType;
  credentials_encrypted: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: string | null;
  created_at: string;
  updated_at: string;
}
